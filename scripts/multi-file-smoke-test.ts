/**
 * Headless proof of cross-file breakpoints (docs/USER_FLOWS.md proposal 1,
 * engine half): sets a breakpoint directly on report.rs -- a file execution
 * has not reached yet, and one this session was never constructed with as
 * its `sourcePath` -- before ever starting the program, then verifies it's
 * hit at the right file/line. This is what a fuzzy file switcher "jump
 * ahead and set a breakpoint" flow ultimately rests on. Run via
 * `npm run smoke:multifile`.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { DebugSession } from "../src/engine/session/DebugSession.js";
import { lldbDapAdapter } from "../src/engine/adapters/lldbDap.js";
import { getFixtureConfig, normalizePath } from "./fixtures.js";
import type { SessionSnapshot, OutputEntry } from "../src/shared/types.js";

const FIXTURE = getFixtureConfig("multi-file-demo");
const FIXTURE_DIR = FIXTURE.cwd;
const PROGRAM = FIXTURE.program;
const SOURCE = FIXTURE.source; // main.rs
const REPORT_PATH = path.join(FIXTURE_DIR, "src", "report.rs");
const REPORT_LINE = 2; // `format!("values={values:?} total={total}")`

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
      programPath: PROGRAM,
      sourcePath: SOURCE,
      cwd: FIXTURE_DIR,
    },
    lldbDapAdapter,
  );

  const outputEntries: OutputEntry[] = [];
  session.onOutput((entry) => outputEntries.push(entry));

  try {
    console.log("[multi-file-smoke] starting session (initial source: main.rs)...");
    const startPromise = session.start();
    await waitForPhase(session, "configuring", "post-handshake");
    await startPromise;

    // Set a breakpoint in report.rs *before* ever starting execution --
    // proves breakpoints work on a file that isn't the session's initial
    // sourcePath and that execution hasn't reached yet.
    await session.toggleBreakpoint(REPORT_PATH, REPORT_LINE);
    const afterBp = session.getSnapshot();
    const bp = afterBp.breakpoints[REPORT_PATH]?.[0];
    assert.ok(bp, "expected a breakpoint descriptor for report.rs");
    assert.equal(bp.line, REPORT_LINE);
    assert.equal(bp.verified, true, "expected the report.rs breakpoint to be verified ahead of execution reaching it");
    console.log("[multi-file-smoke] breakpoint set and verified in report.rs (never visited yet):", bp);

    await session.beginExecution();
    const stopped = await waitForPhase(session, "stopped", "report.rs breakpoint hit");
    console.log(
      "[multi-file-smoke] hit breakpoint, stack:",
      stopped.stack.map((f) => `${f.name}@${f.line} (${f.sourcePath})`),
    );
    assert.ok(stopped.stack.length > 0, "expected a non-empty call stack");
    assert.equal(
      normalizePath(stopped.stack[0]?.sourcePath ?? ""),
      normalizePath(REPORT_PATH),
      "expected the stopped frame's source path to be report.rs, not main.rs",
    );
    assert.equal(stopped.stack[0]?.line, REPORT_LINE);
    assert.ok(
      stopped.stack[0]?.name.includes("report::summarize"),
      `expected top frame to be report::summarize, got "${stopped.stack[0]?.name}"`,
    );

    // lldb-dap names this "Locals"; codelldb names it "Local".
    const localsScope = stopped.scopes.find((s) => s.name === "Locals" || s.name === "Local");
    assert.ok(localsScope, "expected a Locals/Local scope");
    const localVars = stopped.variablesByRef[localsScope.variablesReference] ?? [];
    const byName = Object.fromEntries(localVars.map((v) => [v.name, v.value]));
    console.log("[multi-file-smoke] locals in report::summarize:", byName);
    assert.equal(byName["total"], "30", "expected total=30 (2+4+6+8+10) inside report::summarize");

    // Clear the breakpoint and run to completion.
    await session.toggleBreakpoint(REPORT_PATH, REPORT_LINE);
    await session.continueExecution();
    await waitForPhase(session, "terminated", "run to completion");
    console.log("[multi-file-smoke] program terminated");

    const stdoutText = outputEntries
      .filter((e) => e.category === "stdout")
      .map((e) => e.text)
      .join("");
    assert.ok(
      stdoutText.includes(FIXTURE.expectedSummary),
      `expected final summary line in captured stdout, got: ${stdoutText}`,
    );
    console.log("[multi-file-smoke] captured expected stdout summary line");

    console.log(
      "[multi-file-smoke] SUCCESS: cross-file breakpoint set ahead of execution, hit at the right " +
        "file/line, with correct per-frame sourcePath -- the data a source-follow UI and fuzzy file " +
        "switcher both rely on.",
    );
  } finally {
    await session.terminate().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error("[multi-file-smoke] FAILED:", err);
  process.exit(1);
});
