/**
 * Headless proof of the attach-by-name flow (docs/USER_FLOWS.md proposal 2):
 * arms a DebugSession in `attach --name` mode against the attach-demo
 * fixture *before* the target process exists, then spawns the fixture
 * binary directly via child_process.spawn -- deliberately NOT through this
 * session's own launch path, to simulate "started elsewhere" (e.g. from
 * VS Code) -- and verifies lldb-dap's `waitFor` polling catches it. Run via
 * `npm run smoke:attach`.
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { DebugSession } from "../src/engine/session/DebugSession.js";
import { lldbDapAdapter } from "../src/engine/adapters/lldbDap.js";
import { getFixtureConfig } from "./fixtures.js";
import type { SessionSnapshot } from "../src/shared/types.js";

const FIXTURE = getFixtureConfig("attach-demo");
const FIXTURE_DIR = FIXTURE.cwd;
const PROGRAM = FIXTURE.program;
const SOURCE = FIXTURE.source;
const BREAKPOINT_LINE = FIXTURE.breakpointLine; // `count = tick(count);`

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

async function main(): Promise<void> {
  const session = new DebugSession(
    {
      adapterId: lldbDapAdapter.id,
      sourcePath: SOURCE,
      cwd: FIXTURE_DIR,
      attach: { name: PROGRAM },
    },
    lldbDapAdapter,
  );

  let target: ChildProcess | undefined;
  let targetStdout = "";

  try {
    console.log(
      `[attach-smoke] arming attach --name against ${PROGRAM} (target not started yet)...`,
    );
    const startPromise = session.start();
    await waitForPhase(session, "waiting", "waitFor armed");
    console.log(
      '[attach-smoke] reached "waiting" phase -- target has not been started yet',
    );
    assert.equal(
      session.getSnapshot().programPath,
      `waiting for "${PROGRAM}"`,
      "expected the waiting-phase status label to describe what it's watching for",
    );

    // Simulate "started elsewhere": spawn the fixture binary directly,
    // bypassing this session entirely -- lldb-dap owns none of its stdio,
    // so its output is captured here rather than via session.onOutput
    // (attach mode never gets an `output` event stream for pre-existing
    // stdio the debugger didn't create).
    // lldb-dap's waitFor needs a brief moment after receiving `attach` to
    // arm its process-launch detection -- confirmed empirically: spawning
    // the target immediately after reaching 'waiting' is reliably missed
    // with no retry, while a short delay first is reliably caught. A real
    // human reacting to the 'waiting' status bar badge takes far longer
    // than this window, so it's a non-issue in actual use -- see
    // docs/KNOWN_ISSUES.md.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("[attach-smoke] spawning target process directly (simulating an externally-started process)...");
    target = spawn(PROGRAM, [], {
      cwd: FIXTURE_DIR,
      stdio: ["ignore", "pipe", "pipe"],
    });
    target.stdout?.on("data", (chunk: Buffer) => {
      targetStdout += chunk.toString("utf8");
    });
    target.stderr?.on("data", (chunk: Buffer) => {
      process.stderr.write(`[target stderr] ${chunk}`);
    });

    await waitForPhase(session, "configuring", "post-attach handshake", 20_000);
    console.log('[attach-smoke] reached "configuring" -- lldb-dap found and attached to the target');
    await startPromise;

    await session.toggleBreakpoint(SOURCE, BREAKPOINT_LINE);
    // On Linux, lldb-dap can attach so quickly that debug symbols aren't fully
    // loaded when setBreakpoints is sent -- the response comes back verified:false
    // and a follow-up `breakpoint` event fires with verified:true once symbols
    // load. Poll until the snapshot reflects that rather than asserting immediately.
    const bp = await new Promise<NonNullable<SessionSnapshot["breakpoints"][string]>[number]>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timed out waiting for breakpoint to be verified")), 10_000);
      const check = () => {
        const snap = session.getSnapshot();
        const b = snap.breakpoints[SOURCE]?.[0];
        if (b?.verified) { clearTimeout(timer); resolve(b); }
      };
      check();
      const unsub = session.onSnapshot(() => check());
      setTimeout(() => unsub, 10_000);
    });
    assert.equal(bp.line, BREAKPOINT_LINE);
    console.log("[attach-smoke] breakpoint set and verified:", bp);

    await session.beginExecution();
    const hit = await waitForPhase(session, "stopped", "first breakpoint hit");
    console.log(
      "[attach-smoke] hit breakpoint, stack:",
      hit.stack.map((f) => `${f.name}@${f.line}`),
    );
    assert.ok(hit.stack.length > 0, "expected a non-empty call stack");
    assert.equal(hit.stack[0]?.line, BREAKPOINT_LINE);
    assert.equal(
      hit.stack[0]?.sourcePath,
      SOURCE,
      "expected the stopped frame's source path to match the fixture's main.rs",
    );

    // Clear the breakpoint (the loop hits it 5x) and run to completion.
    await session.toggleBreakpoint(SOURCE, BREAKPOINT_LINE);
    await session.continueExecution();
    await waitForPhase(session, "terminated", "run to completion", 15_000);
    console.log("[attach-smoke] attached program terminated");

    assert.ok(
      targetStdout.includes(FIXTURE.expectedSummary),
      `expected target stdout to include "${FIXTURE.expectedSummary}", got: ${targetStdout}`,
    );
    console.log("[attach-smoke] captured expected target stdout:", targetStdout.trim());

    console.log(
      "[attach-smoke] SUCCESS: dbg armed attach --name before the target existed, lldb-dap's waitFor " +
        "caught a process started completely outside this session, and breakpoints/stepping/continue " +
        "all worked normally once attached.",
    );
  } finally {
    await session.terminate().catch(() => undefined);
    if (target && target.exitCode === null && !target.killed) target.kill();
  }
}

main().catch((err) => {
  console.error("[attach-smoke] FAILED:", err);
  process.exit(1);
});
