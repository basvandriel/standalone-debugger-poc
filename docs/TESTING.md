# Testing & verification

This project has no unit-test framework — verification is done through three
headless smoke tests that each drive a **real** `lldb-dap` process against
bundled fixture binaries, plus a manual real-terminal pass for anything the
headless tests structurally can't see (below).

## Building fixtures

```bash
npm install
npm run build:fixtures
```

## Running everything

```bash
npm run typecheck    # tsc across main/preload, renderer, and TUI tsconfigs
npm run smoke         # engine-only: DapClient + DebugSession, no BrowserWindow
npm run smoke:session # DebugSession end to end (this is what src/main/ipc.ts wraps)
npm run smoke:tui     # real Ink render via ink-testing-library, simulated keystrokes
```

All three spawn a real adapter process and must be confirmed clean afterward:

```bash
ps aux | grep lldb-dap
```

Any `lldb-dap` process still running after a smoke test exits is a bug in
`DebugSession.terminate()`/shutdown handling, not something to ignore.

## What each script covers

- **`scripts/smoke-test.ts`** (`npm run smoke`) — the lowest-level proof:
  drives `DapClient` + `lldbDapAdapter` directly through the full handshake
  (`initialize` → `launch` → `setBreakpoints` → `configurationDone` →
  breakpoint hit → `stackTrace`/`variables` → clear breakpoint → continue to
  completion → `disconnect`). No `DebugSession`, no UI — isolates DAP
  protocol risk from everything built on top of it.
- **`scripts/session-smoke-test.ts`** (`npm run smoke:session`) — exercises
  `DebugSession` itself: breakpoints, stepping (asserting `total`/`doubled`
  values at each stop), watch add/auto-reevaluate/remove, frame selection,
  continue-to-completion with a captured-stdout assertion, **and a full
  restart-after-natural-termination cycle** (verifies the adapter actually
  comes back up, breakpoints re-apply, and the new process hits them).
- **`src/tui/__smoke__/tui-smoke-test.ts`** (`npm run smoke:tui`) — the only
  one that renders real UI: uses `ink-testing-library` to render the actual
  `<App>` component and drives it via simulated `stdin.write()` keystrokes
  (not just calling `DebugSession` methods directly), asserting on both the
  rendered frame text and `useDbgStore.getState()`. Covers the same
  breakpoint/run/step/watch/restart flow as the session test, but through
  the real component tree and real keybinding handlers.

## The gap: `ink-testing-library`'s fake stdin

`ink-testing-library` synthesizes React state updates directly — it does
**not** exercise real terminal I/O (raw mode, PTY escape-sequence parsing,
Node's `readable`-stream event flow). Bugs that only manifest at that layer
are invisible to `npm run smoke:tui` no matter how thorough its assertions
are. Two real bugs in this project were only found this way:

1. **A row-budget miscalculation that made the TUI overflow its terminal
   and scroll.** The headless smoke test's mock terminal is a fixed 24 rows
   and the bug didn't happen to overflow at exactly that size in every
   test path, so it passed cleanly while still being wrong. It was only
   caught and then *confirmed fixed* by driving the real CLI under `expect`
   (see below) at several terminal sizes and counting the actual rendered
   line count against the terminal's row count.
2. An input-delivery anomaly under a scripted `expect`-driven PTY, which
   turned out to affect even a 10-line bare Ink example with no relation to
   this codebase — see [KNOWN_ISSUES.md](KNOWN_ISSUES.md). This one was
   *not* concluded to be a real bug (evidence suggests it's specific to
   `expect`'s pty allocation, not real terminal usage), precisely because
   the headless test gave no signal either way and real-PTY testing was the
   only way to investigate it at all.

### Real-PTY testing technique

When a change touches anything terminal-specific (borders, row/column math,
raw-mode/input handling, screen-buffer escape sequences), verify it against
a real pseudo-terminal, not just the smoke suite. `expect` (present on
macOS by default) works well for this:

```tcl
#!/usr/bin/expect -f
set timeout 15
cd /path/to/repo
spawn ./node_modules/.bin/tsx src/tui/index.tsx run --adapter lldb-dap \
  --program fixtures/loop-demo/target/debug/loop-demo \
  --source fixtures/loop-demo/src/main.rs
stty rows 30 columns 100 < $spawn_out(slave,name)   # must come AFTER spawn
expect "READY"
send "q"
expect eof
```

Two non-obvious things learned the hard way while building this:

- `stty rows/columns` **must** be set after `spawn`, using
  `$spawn_out(slave,name)` — setting it before spawning has no effect since
  the pty doesn't exist yet.
- To inspect exact byte-level output (e.g. confirming an escape sequence
  like `\x1b[?1007h` appears, or counting the true rendered row count
  ignoring ANSI codes), redirect the `expect` script's output to a file and
  parse it in Python: strip `\x1b\[[0-9;?]*[a-zA-Z]` sequences, then count
  non-empty lines between Ink's redraw markers. Piping through `cat` alone
  is not enough to reason about terminal-real row counts, since a single
  logical "frame" is delivered as incremental cursor-up/erase/redraw
  sequences, not a full clear on every update.

## Verification discipline

After any change to `DebugSession`, the DAP layer, or either frontend's
session-lifecycle handling (start/restart/terminate):

1. `npm run typecheck`
2. `npm run smoke && npm run smoke:session && npm run smoke:tui`
3. `ps aux | grep lldb-dap` — confirm nothing orphaned
4. If the change touches TUI rendering/input/terminal escape sequences
   specifically: a real-PTY pass per the technique above, since the smoke
   suite structurally cannot see that class of bug.
