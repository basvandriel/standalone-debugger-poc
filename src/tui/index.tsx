// "unused" React import is required: tsx's automatic JSX runtime silently
// breaks useEffect for components imported from other files without it.
import React from 'react';
import { render } from 'ink';
import { parseCliOptions } from '../main/cli.js';
import { DebugSession } from '../engine/session/DebugSession.js';
import { lldbDapAdapter } from '../engine/adapters/lldbDap.js';
import { App } from './App.js';

const cliOptions = parseCliOptions(process.argv.slice(2));
if (!cliOptions) {
  process.exit(1);
}

const adapter = cliOptions.adapter === lldbDapAdapter.id ? lldbDapAdapter : undefined;
if (!adapter) {
  console.error(`dbg: unsupported adapter "${cliOptions.adapter}" (only "lldb-dap" is available in this POC)`);
  process.exit(1);
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

const { waitUntilExit } = render(<App session={session} />, { alternateScreen: true });

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

// Covers Ctrl+C / kill in addition to the in-app `q`/`:quit` paths, so a
// forcibly-closed terminal doesn't leave the adapter process running.
async function shutdown(): Promise<void> {
  disableScrollCapture();
  await session.terminate().catch(() => undefined);
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

await waitUntilExit();
disableScrollCapture();
