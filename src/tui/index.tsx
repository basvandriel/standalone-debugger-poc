// "unused" React import is required: tsx's automatic JSX runtime silently
// breaks useEffect for components imported from other files without it.
import React from 'react';
import { access, open, type FileHandle } from 'node:fs/promises';
import { render } from 'ink';
import { parseCliOptions } from '../main/cli.js';
import { DebugSession } from '../engine/session/DebugSession.js';
import { getAdapter, adapterById } from '../engine/adapters/index.js';
import { App } from './App.js';
import { useUiStore } from '../shared/ui/useUiStore.js';

const cliOptions = parseCliOptions(process.argv.slice(2));
if (!cliOptions) {
  process.exit(1);
}

const adapter = getAdapter(cliOptions.adapter);
if (!adapter) {
  console.error(`dbg: unsupported adapter "${cliOptions.adapter}" (supported adapters: ${Object.keys(adapterById).join(', ')})`);
  process.exit(1);
}

try {
  await access(cliOptions.program);
} catch {
  console.error(`dbg: program binary does not exist: ${cliOptions.program}`);
  process.exit(1);
}

let logHandle: FileHandle | undefined;
if (cliOptions.logFile) {
  try {
    logHandle = await open(cliOptions.logFile, 'a');
    await logHandle.write(`\n=== dbg session started ${new Date().toISOString()} ===\n`);
  } catch (err) {
    console.error(`dbg: failed to open log file ${cliOptions.logFile}:`, err);
  }
}

const MAX_LOG_PAYLOAD_CHARS = 8_000;
const LOG_FLUSH_INTERVAL_MS = 60;
const LOG_FLUSH_CHUNK_SIZE = 200;
let logQueue: string[] = [];
let logFlushTimer: NodeJS.Timeout | undefined;
let logFlushInFlight = false;

function clip(text: string, max = MAX_LOG_PAYLOAD_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)} ...<truncated ${text.length - max} chars>`;
}

function formatPayload(payload: unknown): string {
  try {
    return clip(JSON.stringify(payload));
  } catch {
    return '[unserializable payload]';
  }
}

async function flushLogQueue(force = false): Promise<void> {
  if (!logHandle || logFlushInFlight || logQueue.length === 0) return;
  logFlushInFlight = true;
  try {
    while (logQueue.length > 0) {
      const take = force ? logQueue.length : Math.min(LOG_FLUSH_CHUNK_SIZE, logQueue.length);
      const chunk = logQueue.splice(0, take).join('');
      await logHandle.write(chunk);
      if (!force) break;
    }
  } finally {
    logFlushInFlight = false;
  }
}

function scheduleLogFlush(): void {
  if (!logHandle) return;
  if (logFlushTimer) return;
  logFlushTimer = setTimeout(() => {
    logFlushTimer = undefined;
    void flushLogQueue();
  }, LOG_FLUSH_INTERVAL_MS);
}

function writeLog(message: string): void {
  if (!logHandle) return;
  logQueue.push(`${new Date().toISOString()} ${clip(message)}\n`);
  scheduleLogFlush();
}

const session = new DebugSession(
  {
    adapterId: cliOptions.adapter,
    programPath: cliOptions.program,
    sourcePath: cliOptions.source,
    cwd: cliOptions.cwd
  },
  adapter
);

const unsubscribeOutput = session.onOutput((entry) => {
  writeLog(`[OUTPUT ${entry.category}] ${clip(entry.text.replace(/\r?\n/g, '\\n'))}`);
});
const unsubscribeDapLog = session.onDapLog((entry) => {
  writeLog(`[DAP ${entry.direction}] ${formatPayload(entry.payload)}`);
});
const unsubscribeSnapshot = session.onSnapshot((snapshot) => {
  if (snapshot.phase === 'error') {
    const message = snapshot.errorMessage ? `session error: ${snapshot.errorMessage}` : 'session entered error state';
    writeLog(`[ERROR] ${message}`);
    process.stderr.write(`${message}\n`);
  }
});

const { waitUntilExit } = render(<App session={session} />, { alternateScreen: true });

function wheelDeltaFromChunk(chunk: Buffer): number {
  const text = chunk.toString('latin1');
  let delta = 0;

  // SGR mouse events: ESC [ < Cb ; Cx ; Cy M/m
  const sgr = /\x1b\[<(\d+);\d+;\d+[mM]/g;
  let m: RegExpExecArray | null;
  while ((m = sgr.exec(text)) !== null) {
    const code = Number(m[1]);
    if (code >= 64 && code < 128) {
      const baseCode = code & 0b11;
      if (baseCode === 0) delta -= 1;
      else if (baseCode === 1) delta += 1;
    }
  }

  // Some terminals emit arrows for wheel in alt-screen mode.
  delta += (text.match(/\x1b\[B/g) ?? []).length;
  delta -= (text.match(/\x1b\[A/g) ?? []).length;

  return delta;
}

let pendingWheelDelta = 0;
let wheelTimer: NodeJS.Timeout | undefined;

function applyWheelStep(): void {
  wheelTimer = undefined;
  if (pendingWheelDelta === 0) return;

  const ui = useUiStore.getState();
  if (ui.focusedPanel !== 'source') {
    pendingWheelDelta = 0;
    return;
  }

  // Drain in small chunks to keep motion smooth and predictable even when
  // trackpad momentum delivers bursts of events in one tick.
  const step = Math.sign(pendingWheelDelta) * Math.min(Math.abs(pendingWheelDelta), 2);
  pendingWheelDelta -= step;

  const maxLine = Math.max(1, ui.sourceLines.length);
  ui.setCursorLine(Math.min(maxLine, Math.max(1, ui.cursorLine + step)));

  if (pendingWheelDelta !== 0) {
    wheelTimer = setTimeout(applyWheelStep, 16);
  }
}

function onRawStdin(chunk: Buffer): void {
  const delta = wheelDeltaFromChunk(chunk);
  if (delta === 0) return;

  pendingWheelDelta += delta;
  const clamp = 120;
  if (pendingWheelDelta > clamp) pendingWheelDelta = clamp;
  if (pendingWheelDelta < -clamp) pendingWheelDelta = -clamp;

  if (!wheelTimer) {
    wheelTimer = setTimeout(applyWheelStep, 0);
  }
}

process.stdin.on('data', onRawStdin);

// Stop the terminal from doing anything native (scrollback, text selection)
// with mouse/trackpad input while this full-screen app owns the screen --
// same as vim (`mouse=a`), htop, less, and tmux all do. Two layers:
//
// 1. DECSET 1007 "alternate scroll mode" -- a convenience some terminals
//    implement that translates a scroll gesture into Up/Down arrow-key
//    sequences (which every panel already handles as navigation) instead of
//    native scrollback. Whether a given terminal actually honors this when
//    the app asks for it is inconsistent (e.g. iTerm2 requires the user to
//    separately opt in via a preference), so it's not relied on alone.
// 2. SGR mouse tracking (1000 + 1006) -- the real, universally-honored
//    mechanism: once enabled, the terminal hands every mouse/scroll event
//    to this process as an escape sequence instead of acting on it itself,
//    full stop. Ink has no mouse-event parsing at all, so these sequences
//    just arrive as unrecognized `input` strings in useInput handlers and
//    are silently ignored (verified: they parse as one opaque CSI sequence
//    starting with `[<`, never as a recognized key, so they can't collide
//    with any single-key binding) -- but critically the terminal no longer
//    tries to scroll or select text with them either. The trade-off: normal
//    click-drag text selection stops working while this app is running;
//    most terminals (Terminal.app/iTerm2 included) let you hold Option
//    while dragging to select text anyway, bypassing app mouse capture.
process.stdout.write('\x1b[?1007h\x1b[?1000h\x1b[?1006h');
function disableScrollCapture(): void {
  process.stdout.write('\x1b[?1006l\x1b[?1000l\x1b[?1007l');
}

async function closeLog(): Promise<void> {
  if (!logHandle) return;
  try {
    if (logFlushTimer) {
      clearTimeout(logFlushTimer);
      logFlushTimer = undefined;
    }
    await flushLogQueue(true);
    await logHandle.write(`=== dbg session ended ${new Date().toISOString()} ===\n`);
    await logHandle.close();
    logHandle = undefined;
  } catch {
    // ignore
  }
}

// Covers Ctrl+C / kill in addition to the in-app `q`/`:quit` paths, so a
// forcibly-closed terminal doesn't leave the adapter process running.
async function shutdown(): Promise<void> {
  unsubscribeOutput();
  unsubscribeDapLog();
  unsubscribeSnapshot();
  process.stdin.off('data', onRawStdin);
  if (wheelTimer) clearTimeout(wheelTimer);
  disableScrollCapture();
  await session.terminate().catch(() => undefined);
  await closeLog();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
process.on('uncaughtException', async (err) => {
  disableScrollCapture();
  process.stderr.write(`dbg: uncaught exception: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  await closeLog();
  process.exit(1);
});
process.on('unhandledRejection', async (reason) => {
  disableScrollCapture();
  process.stderr.write(`dbg: unhandled rejection: ${reason instanceof Error ? reason.stack ?? reason.message : String(reason)}\n`);
  await closeLog();
  process.exit(1);
});

await waitUntilExit();
unsubscribeOutput();
unsubscribeDapLog();
unsubscribeSnapshot();
process.stdin.off('data', onRawStdin);
if (wheelTimer) clearTimeout(wheelTimer);
disableScrollCapture();
await closeLog();
