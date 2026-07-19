/**
 * Headless TUI verification: renders the real Ink <App> via
 * ink-testing-library against the real loop-demo fixture and lldb-dap,
 * simulating actual keypresses and asserting on the rendered frame text.
 * Unlike the Electron app, Ink is a plain terminal program with no GUI
 * binary to launch, so this can genuinely exercise the rendered UI rather
 * than only the engine underneath it.
 */
import assert from "node:assert/strict";
import { render } from "ink-testing-library";
import React from "react";
import { DebugSession } from "../../engine/session/DebugSession.js";
import { lldbDapAdapter } from "../../engine/adapters/lldbDap.js";
import { App } from "../App.js";
import { useUiStore } from "../../shared/ui/useUiStore.js";
import { useDbgStore } from "../../shared/ui/useDbgStore.js";
import { getFixtureConfig } from "../../../scripts/fixtures.js";

const FIXTURE = getFixtureConfig("loop-demo");
const FIXTURE_DIR = FIXTURE.cwd;
const PROGRAM = FIXTURE.program;
const SOURCE = FIXTURE.source;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(
  predicate: () => boolean,
  label: string,
  ms = 15_000,
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > ms)
      throw new Error(`timed out waiting for: ${label}`);
    await sleep(50);
  }
}

async function main(): Promise<void> {
  // Fresh state -- these are module-singleton stores, and this script runs
  // in the same process as everything else being asserted against.
  useUiStore.setState({
    focusedPanel: "source",
    cursorLine: 1,
    sourceLines: [],
    selectedVariableIndex: 0,
    expandedRefs: new Set(),
    selectedWatchIndex: 0,
    outputTab: "program",
    commandBarOpen: false,
    commandBarValue: "",
    collapsedPanels: new Set(),
    activeSourcePath: undefined,
    knownSourceFiles: [],
    fileSwitcherOpen: false,
    fileSwitcherQuery: "",
  });
  useDbgStore.setState({ snapshot: undefined, output: [], dapLog: [] });

  const session = new DebugSession(
    {
      adapterId: "lldb-dap",
      programPath: PROGRAM,
      sourcePath: SOURCE,
      cwd: FIXTURE_DIR,
    },
    lldbDapAdapter,
  );

  const { lastFrame, stdin, unmount } = render(
    React.createElement(App, { session }),
  );

  console.log("[tui-smoke] waiting for configuring phase...");
  await waitFor(
    () => useDbgStore.getState().snapshot?.phase === "configuring",
    "configuring phase",
  );
  await sleep(200); // let a render flush so lastFrame() reflects it
  console.log("[tui-smoke] frame after reaching configuring:\n" + lastFrame());
  assert.ok(
    lastFrame()?.includes("READY"),
    "expected READY phase badge in configuring state",
  );
  assert.ok(
    lastFrame()?.includes("main.rs"),
    "expected source file name visible",
  );

  // Move cursor down to line 7 (`total += doubled as i64;`) and set a breakpoint.
  for (let i = 0; i < 6; i++) stdin.write("j");
  await sleep(100);
  stdin.write("b");
  await waitFor(
    () =>
      (useDbgStore.getState().snapshot?.breakpoints[SOURCE]?.length ?? 0) > 0,
    "breakpoint registered in snapshot",
  );
  const bp = useDbgStore.getState().snapshot?.breakpoints[SOURCE]?.[0];
  assert.equal(bp?.line, 7, `expected breakpoint on line 7, got ${bp?.line}`);
  assert.equal(bp?.verified, true, "expected breakpoint to be verified");
  console.log("[tui-smoke] breakpoint set and verified at line 7");

  // Start execution, wait for the breakpoint to hit.
  // Sleep before sending 'c' to let Ink re-render with the latest snapshot --
  // useTuiKeybindings guards on the render-time snapshot prop being non-null,
  // and the waitFor above only confirms the zustand store updated, not that
  // the component tree has flushed the new snapshot into the hook closure yet.
  await sleep(200);
  stdin.write("c");
  await waitFor(
    () => useDbgStore.getState().snapshot?.phase === "stopped",
    "stopped at breakpoint",
  );
  await sleep(300);
  const stoppedFrame = lastFrame() ?? "";
  console.log("[tui-smoke] frame after hitting breakpoint:\n" + stoppedFrame);
  assert.ok(stoppedFrame.includes("PAUSED"), "expected PAUSED phase badge");

  // The mock terminal's non-TTY fallback is only 24 rows (real terminals are
  // typically 40+), which is too cramped for 3 stacked side panels to show
  // variable rows -- verify the actual data via state directly instead,
  // same as the other headless smoke tests do.
  const stoppedSnapshot = useDbgStore.getState().snapshot;
  const localsScope = stoppedSnapshot?.scopes.find((s) => s.name === "Locals");
  const localVars = localsScope
    ? stoppedSnapshot?.variablesByRef[localsScope.variablesReference]
    : undefined;
  const byName = Object.fromEntries(
    (localVars ?? []).map((v) => [v.name, v.value]),
  );
  console.log("[tui-smoke] locals at first stop:", byName);
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

  // Add a watch via the command bar.
  stdin.write(":");
  await sleep(50);
  assert.equal(
    useUiStore.getState().commandBarOpen,
    true,
    "expected command bar to open",
  );
  for (const ch of "watch total * 2") stdin.write(ch);
  stdin.write("\r");
  await waitFor(
    () => (useDbgStore.getState().snapshot?.watches.length ?? 0) > 0,
    "watch added",
  );
  const watch = useDbgStore.getState().snapshot?.watches[0];
  assert.equal(watch?.expression, "total * 2");
  assert.equal(
    watch?.value,
    "0",
    "expected watch to evaluate to 0 at first stop",
  );
  console.log("[tui-smoke] watch added and evaluated:", watch);

  // Clear the breakpoint (fixture loops over it 5x) and run to completion.
  // Cursor is already at line 7 from setting it earlier -- no navigation needed.
  stdin.write("b");
  await waitFor(
    () =>
      (useDbgStore.getState().snapshot?.breakpoints[SOURCE]?.length ?? 0) === 0,
    "breakpoint cleared",
  );
  await sleep(200);
  stdin.write("c");
  await waitFor(
    () => useDbgStore.getState().snapshot?.phase === "terminated",
    "program terminated",
    15_000,
  );
  await sleep(300);
  const finalFrame = lastFrame() ?? "";
  console.log("[tui-smoke] frame after termination:\n" + finalFrame);
  assert.ok(finalFrame.includes("EXITED"), "expected EXITED phase badge");

  const finalSnapshot = useDbgStore.getState().snapshot;
  assert.equal(
    finalSnapshot?.stack.length,
    0,
    "expected stack cleared after termination",
  );
  assert.equal(
    finalSnapshot?.watches[0]?.error,
    "not running",
    "expected watch marked not running",
  );

  const stdoutText = useDbgStore
    .getState()
    .output.filter((e) => e.category === "stdout")
    .map((e) => e.text)
    .join("");
  assert.ok(
    stdoutText.includes("items=[2, 4, 6, 8, 10] total=30"),
    "expected final summary line in captured stdout",
  );
  console.log("[tui-smoke] captured expected stdout summary line");

  // Pressing 'c' (start/continue) while EXITED restarts the session --
  // this is exactly the "can't restart after exited" bug the TUI hit.
  await sleep(200);
  stdin.write("c");
  await waitFor(
    () => useDbgStore.getState().snapshot?.phase === "configuring",
    "configuring after restart",
  );
  console.log("[tui-smoke] restart() reached configuring phase");

  // Cursor is still at line 7 from before -- set a breakpoint on the fresh adapter.
  stdin.write("b");
  await waitFor(
    () =>
      (useDbgStore.getState().snapshot?.breakpoints[SOURCE]?.length ?? 0) > 0,
    "breakpoint re-registered after restart",
  );
  const bpAfterRestart =
    useDbgStore.getState().snapshot?.breakpoints[SOURCE]?.[0];
  assert.equal(
    bpAfterRestart?.verified,
    true,
    "expected breakpoint to be verified on the restarted adapter",
  );

  await sleep(200);
  stdin.write("c");
  await waitFor(
    () => useDbgStore.getState().snapshot?.phase === "stopped",
    "stopped at breakpoint after restart",
  );
  const stoppedAfterRestart = useDbgStore.getState().snapshot;
  assert.equal(
    stoppedAfterRestart?.stack[0]?.line,
    7,
    "expected restarted session to hit the same breakpoint",
  );
  console.log("[tui-smoke] restarted session hit breakpoint correctly");

  // 'q' quits and terminates the session.
  stdin.write("q");
  await sleep(1000);

  unmount();
  console.log(
    "[tui-smoke] SUCCESS: TUI rendered and interactive against real lldb-dap session end to end.",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[tui-smoke] FAILED:", err);
  process.exit(1);
});
