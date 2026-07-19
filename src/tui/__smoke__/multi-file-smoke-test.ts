/**
 * Headless UI-level proof of the multi-file follow + fuzzy file switcher
 * (docs/USER_FLOWS.md proposal 1): renders the real Ink <App> via
 * ink-testing-library against the multi-file-demo fixture and drives it
 * with simulated keystrokes, same technique as tui-smoke-test.ts. Covers
 * what the headless engine-only multi-file-smoke-test.ts structurally
 * cannot: that the source panel actually follows execution across files in
 * the real component tree, and that the fuzzy switcher can jump to a file
 * before execution has ever reached it. Run via `npm run smoke:tui:multifile`.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { render } from "ink-testing-library";
import React from "react";
import { DebugSession } from "../../engine/session/DebugSession.js";
import { lldbDapAdapter } from "../../engine/adapters/lldbDap.js";
import { App } from "../App.js";
import { useUiStore } from "../../shared/ui/useUiStore.js";
import { useDbgStore } from "../../shared/ui/useDbgStore.js";
import { getFixtureConfig } from "../../../scripts/fixtures.js";

const FIXTURE = getFixtureConfig("multi-file-demo");
const FIXTURE_DIR = FIXTURE.cwd;
const PROGRAM = FIXTURE.program;
const SOURCE = FIXTURE.source; // main.rs
const OPS_PATH = path.join(FIXTURE_DIR, "src", "ops.rs");
const MAIN_PATH = SOURCE;

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

  console.log("[tui-multifile-smoke] waiting for configuring phase...");
  await waitFor(
    () => useDbgStore.getState().snapshot?.phase === "configuring",
    "configuring phase",
  );
  await waitFor(
    () => useUiStore.getState().activeSourcePath === MAIN_PATH,
    "activeSourcePath initialized from --source",
  );
  await sleep(200);
  console.log(
    "[tui-multifile-smoke] frame after reaching configuring:\n" + lastFrame(),
  );
  assert.ok(
    lastFrame()?.includes("main.rs"),
    "expected initial view to show main.rs",
  );

  // Open the fuzzy switcher and jump to ops.rs -- a file execution has not
  // visited yet, only known because of the directory scan seeded at start.
  stdin.write("f");
  await waitFor(
    () => useUiStore.getState().fileSwitcherOpen === true,
    "file switcher open",
  );
  for (const ch of "ops") stdin.write(ch);
  await sleep(150);
  stdin.write("\r");
  await waitFor(
    () => useUiStore.getState().activeSourcePath === OPS_PATH,
    "switched to ops.rs via fuzzy switcher",
  );
  await sleep(200);
  console.log(
    "[tui-multifile-smoke] frame after jumping to ops.rs:\n" + lastFrame(),
  );
  assert.ok(
    lastFrame()?.includes("ops.rs"),
    "expected panel title to show ops.rs after fuzzy jump",
  );
  assert.equal(
    useUiStore.getState().fileSwitcherOpen,
    false,
    "expected switcher to close after Enter",
  );

  // Set a breakpoint on ops.rs (line 2, `x * 2`) while it's the active file.
  stdin.write("j");
  stdin.write("b");
  await waitFor(
    () => (useDbgStore.getState().snapshot?.breakpoints[OPS_PATH]?.length ?? 0) > 0,
    "breakpoint registered on ops.rs",
  );
  const opsBp = useDbgStore.getState().snapshot?.breakpoints[OPS_PATH]?.[0];
  assert.equal(opsBp?.line, 2, `expected breakpoint on ops.rs line 2, got ${opsBp?.line}`);
  assert.equal(opsBp?.verified, true, "expected ops.rs breakpoint to be verified");
  console.log("[tui-multifile-smoke] breakpoint set and verified on ops.rs:", opsBp);

  // Switch back to main.rs *before* running, so hitting the ops.rs
  // breakpoint has to auto-follow the panel away from what's on screen --
  // the actual "follow, don't ask" behavior being proven here.
  stdin.write("f");
  await waitFor(
    () => useUiStore.getState().fileSwitcherOpen === true,
    "file switcher re-opened",
  );
  for (const ch of "main") stdin.write(ch);
  await sleep(150);
  stdin.write("\r");
  await waitFor(
    () => useUiStore.getState().activeSourcePath === MAIN_PATH,
    "switched back to main.rs",
  );
  console.log("[tui-multifile-smoke] switched back to main.rs before running");

  stdin.write("c");
  await waitFor(
    () => useDbgStore.getState().snapshot?.phase === "stopped",
    "stopped at ops.rs breakpoint",
  );
  await waitFor(
    () => useUiStore.getState().activeSourcePath === OPS_PATH,
    "panel auto-followed to ops.rs after stopping there",
  );
  await sleep(200);
  const stoppedFrame = lastFrame() ?? "";
  console.log(
    "[tui-multifile-smoke] frame after auto-follow to ops.rs:\n" + stoppedFrame,
  );
  assert.ok(
    stoppedFrame.includes("PAUSED"),
    "expected PAUSED phase badge",
  );
  assert.ok(
    stoppedFrame.includes("ops.rs"),
    "expected panel title to have followed to ops.rs, not stayed on main.rs",
  );

  const stoppedSnapshot = useDbgStore.getState().snapshot;
  assert.equal(
    stoppedSnapshot?.stack[0]?.sourcePath,
    OPS_PATH,
    "expected top frame's sourcePath to be ops.rs",
  );

  stdin.write("q");
  await sleep(1000);

  unmount();
  console.log(
    "[tui-multifile-smoke] SUCCESS: fuzzy switcher jumped to an unvisited file, breakpoints set there " +
      "correctly, and the source panel auto-followed execution there from a different file on screen -- " +
      "all through the real component tree and real keybinding handlers.",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[tui-multifile-smoke] FAILED:", err);
  process.exit(1);
});
