/**
 * M2 headless proof: exercises the DebugSession class -- the exact same
 * engine code src/main/ipc.ts wraps -- end to end against the loop-demo
 * fixture. This validates everything IPC/main/preload/renderer just thinly
 * relay, without needing a real Electron window (which this sandbox cannot
 * launch). Run via `npm run smoke:session`.
 */
import assert from "node:assert/strict";
import { DebugSession } from "../src/engine/session/DebugSession.js";
import { lldbDapAdapter } from "../src/engine/adapters/lldbDap.js";
import { getFixtureConfig, normalizePath } from "./fixtures.js";
import type { SessionSnapshot, OutputEntry } from "../src/shared/types.js";

// LLDB 20 on Windows crashes (0xC0000409) reading Rust PDB debug symbols during
// scopes/variables requests. The C fixture has simpler COFF/PDB symbols that
// LLDB handles correctly. Variable names and expected output are identical.
const FIXTURE = getFixtureConfig(process.platform === "win32" ? "c-loop" : "loop-demo");
const FIXTURE_DIR = FIXTURE.cwd;
const PROGRAM = FIXTURE.program;
const SOURCE = FIXTURE.source;
const BREAKPOINT_LINE = FIXTURE.breakpointLine;

function waitForPhase(
  session: DebugSession,
  phase: SessionSnapshot["phase"],
  label: string,
  ms = 15_000,
): Promise<SessionSnapshot> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(new Error(`timed out waiting for phase "${phase}" (${label})`)),
      ms,
    );
    const current = session.getSnapshot();
    if (current.phase === phase) {
      clearTimeout(timer);
      resolve(current);
      return;
    }
    const unsubscribe = session.onSnapshot((snapshot) => {
      if (snapshot.phase === phase) {
        clearTimeout(timer);
        unsubscribe();
        resolve(snapshot);
      } else if (snapshot.phase === "error") {
        clearTimeout(timer);
        unsubscribe();
        reject(
          new Error(
            `session entered error phase while waiting for "${phase}": ${snapshot.errorMessage}`,
          ),
        );
      }
    });
  });
}

/**
 * Unlike waitForPhase, this never short-circuits on the current snapshot --
 * needed for step commands, where phase stays "stopped" throughout (by
 * design, per DebugSession.step()'s doc comment) and only the snapshot
 * *content* changes once the follow-up `stopped` event lands. Register
 * before firing the triggering request to avoid missing a fast event.
 */
function waitForNextSnapshot(
  session: DebugSession,
  predicate: (snapshot: SessionSnapshot) => boolean,
  label: string,
  ms = 15_000,
): Promise<SessionSnapshot> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out waiting for: ${label}`)),
      ms,
    );
    const unsubscribe = session.onSnapshot((snapshot) => {
      if (predicate(snapshot)) {
        clearTimeout(timer);
        unsubscribe();
        resolve(snapshot);
      } else if (snapshot.phase === "error") {
        clearTimeout(timer);
        unsubscribe();
        reject(
          new Error(
            `session entered error phase while waiting for "${label}": ${snapshot.errorMessage}`,
          ),
        );
      }
    });
  });
}

async function main(): Promise<void> {
  const session = new DebugSession(
    {
      adapterId: lldbDapAdapter.id,
      programPath: PROGRAM,
      sourcePath: SOURCE,
      cwd: FIXTURE_DIR,
    },
    lldbDapAdapter,
  );

  const outputEntries: OutputEntry[] = [];
  session.onOutput((entry) => outputEntries.push(entry));

  console.log("[session-smoke] starting session...");
  const startPromise = session.start();
  await waitForPhase(session, "configuring", "post-handshake");
  await startPromise;
  console.log('[session-smoke] reached "configuring" phase');

  await session.toggleBreakpoint(SOURCE, BREAKPOINT_LINE);
  const afterBp = session.getSnapshot();
  const bp = afterBp.breakpoints[SOURCE]?.[0];
  assert.ok(bp, "expected a breakpoint descriptor after toggleBreakpoint");
  assert.equal(bp.line, BREAKPOINT_LINE);
  assert.equal(bp.verified, true, "expected breakpoint to be verified");
  console.log("[session-smoke] breakpoint set and verified:", bp);

  await session.beginExecution();
  const stopped = await waitForPhase(
    session,
    "stopped",
    "first breakpoint hit",
  );
  console.log(
    "[session-smoke] hit breakpoint, stack:",
    stopped.stack.map((f) => `${f.name}@${f.line}`),
  );
  assert.ok(stopped.stack.length > 0, "expected a non-empty call stack");
  const expectedFrame = FIXTURE.name === "loop-demo" ? "loop_demo::main" : "main";
  assert.ok(
    stopped.stack[0]?.name.startsWith(expectedFrame),
    `expected top frame to start with "${expectedFrame}"`,
  );
  assert.equal(stopped.stack[0]?.line, BREAKPOINT_LINE);

  const localsScope = stopped.scopes.find((s) => s.name === "Locals");
  assert.ok(localsScope, "expected a Locals scope");
  const localVars =
    stopped.variablesByRef[localsScope.variablesReference] ?? [];
  const byName = Object.fromEntries(localVars.map((v) => [v.name, v.value]));
  console.log("[session-smoke] locals at first stop:", byName);
  assert.equal(
    byName["total"],
    "0",
    "expected total=0 before first accumulation",
  );
  assert.equal(
    byName["doubled"],
    "2",
    "expected doubled=2 (double(1)) at first stop",
  );

  await session.addWatch("total * 2");
  const afterWatch = session.getSnapshot();
  const watch = afterWatch.watches[0];
  assert.ok(watch, "expected a watch entry");
  assert.equal(
    watch.value,
    "0",
    'expected watch "total * 2" to evaluate to 0 at first stop',
  );
  console.log("[session-smoke] watch evaluated:", watch);

  const stepPromise = waitForNextSnapshot(
    session,
    (s) => s.phase === "stopped",
    "after stepOver",
  );
  await session.stepOver();
  const afterStep = await stepPromise;
  const localsScope2 = afterStep.scopes.find((s) => s.name === "Locals");
  const localVars2 =
    afterStep.variablesByRef[localsScope2!.variablesReference] ?? [];
  const byName2 = Object.fromEntries(localVars2.map((v) => [v.name, v.value]));
  console.log("[session-smoke] locals after stepOver:", byName2);
  assert.equal(
    byName2["total"],
    "2",
    "expected total=2 after stepping over the accumulation line",
  );

  const watchAfterStep = afterStep.watches[0];
  assert.equal(
    watchAfterStep?.value,
    "4",
    "expected watch to auto-reevaluate to 4 (total=2 * 2)",
  );
  console.log(
    "[session-smoke] watch auto-reevaluated after step:",
    watchAfterStep,
  );

  const frameId = afterStep.stack[0]!.id;
  await session.selectFrame(frameId);
  console.log("[session-smoke] selectFrame round-trip ok");

  await session.removeWatch(watch.id);
  const afterRemove = session.getSnapshot();
  assert.equal(
    afterRemove.watches.length,
    0,
    "expected watch list to be empty after removeWatch",
  );

  // Clear the breakpoint (fixture loops over it 5 times) and run to completion.
  await session.toggleBreakpoint(SOURCE, BREAKPOINT_LINE);
  await session.continueExecution();
  await waitForPhase(session, "terminated", "run to completion", 15_000);
  console.log("[session-smoke] program terminated");

  const stdoutText = outputEntries
    .filter((e) => e.category === "stdout")
    .map((e) => e.text)
    .join("");
  assert.ok(
    stdoutText.includes("items=[2, 4, 6, 8, 10] total=30"),
    "expected final summary line in captured stdout",
  );
  console.log("[session-smoke] captured expected stdout summary line");

  // Restart-after-exit: the session just reached 'terminated' naturally.
  // restart() must spin up a brand-new adapter process and reach
  // 'configuring' again, fully functional (breakpoints/execution working),
  // without needing a new DebugSession instance.
  console.log(
    "[session-smoke] restarting session after natural termination...",
  );
  const restartPromise = session.restart();
  await waitForPhase(session, "configuring", "post-restart handshake");
  await restartPromise;
  console.log('[session-smoke] restart() reached "configuring" phase');

  await session.toggleBreakpoint(SOURCE, BREAKPOINT_LINE);
  const bpAfterRestart = session.getSnapshot().breakpoints[SOURCE]?.[0];
  assert.ok(
    bpAfterRestart,
    "expected a breakpoint descriptor after restart + toggleBreakpoint",
  );
  assert.equal(
    bpAfterRestart.verified,
    true,
    "expected breakpoint to be verified on the restarted adapter",
  );

  await session.beginExecution();
  const stoppedAfterRestart = await waitForPhase(
    session,
    "stopped",
    "breakpoint hit after restart",
  );
  assert.equal(
    stoppedAfterRestart.stack[0]?.line,
    BREAKPOINT_LINE,
    "expected restarted session to hit the same breakpoint",
  );
  console.log("[session-smoke] restarted session hit breakpoint correctly");

  await session.terminate();
  console.log(
    "[session-smoke] terminate() completed (adapter process disconnected/killed)",
  );

  console.log(
    "[session-smoke] SUCCESS: DebugSession start/breakpoints/stop/variables/watch/step/continue/restart/terminate " +
      "all verified against the real loop-demo fixture via lldb-dap.",
  );
}

main().catch((err) => {
  console.error("[session-smoke] FAILED:", err);
  process.exit(1);
});
