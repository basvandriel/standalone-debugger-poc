# Known issues & limitations

## Scope limitations (by design, not bugs)

- **Two DAP adapters are wired up: `lldb-dap` (Rust / C / C++) and `debugpy` (Python).** The
  `AdapterDefinition` interface (`src/engine/adapters/types.ts`) exists
  specifically so further adapters (delve for Go, codelldb as an alternative, ...) can be
  added without touching the transport layer.
- **Rust `Vec` pretty-printing quality depends on the local LLVM/lldb
  build.** If a `Vec<T>` shows raw `RawVec` internals instead of `[1, 2, 3]`,
  that's a gap in the locally installed lldb's Rust formatters, not a bug in
  `DebugSession` or the DAP client.
- **The TUI has no mouse/click support.** Ink doesn't provide native mouse
  handling, and this matches k9s/lazygit's keyboard-first philosophy rather
  than being an oversight — see [KEYBINDINGS.md](KEYBINDINGS.md) for the
  full keyboard-only interaction model.

## Windows: Rust debugging requires CodeLLDB (standard LLVM crashes)

**Standard LLVM `lldb-dap` crashes on Rust PDB debug symbols.** Use CodeLLDB
instead (see below).

`lldb-dap` from the official LLVM Windows package crashes with `0xC0000409`
(Windows `/GS` security kill: stack buffer overrun) when reading Rust PDB debug
symbols — specifically during the `scopes`/`variables` DAP requests after a
breakpoint hits. C and C++ work fine.

**Root cause:** LLDB's PDB reader was built for C/C++. Rust on the MSVC target
produces PDB files with far more complex type encodings (generic
monomorphizations, iterator internals, etc.) that trigger a stack buffer overrun
in LLDB's PDB parsing code.

**Fix: use CodeLLDB's bundled LLDB.** The adapter resolver on Windows
(`src/engine/adapters/lldbDap.ts`) automatically prefers `codelldb.exe` over
`lldb-dap.exe` because CodeLLDB ships a patched LLDB build with a working Rust
PDB reader and Rust NatVis formatters. It checks (in order):

1. `C:\codelldb\extension\adapter\codelldb.exe` — the CI/bundled download path
2. `%USERPROFILE%\.vscode\extensions\vadimcn.vscode-lldb-*\extension\adapter\codelldb.exe` — the [CodeLLDB VS Code extension](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb) auto-detected from your extensions directory
3. `codelldb` on PATH
4. Falls back to `lldb-dap` (C/C++ only)

**To get full Rust debugging on Windows:** install the [CodeLLDB VS Code
extension](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb)
(recommended — it also gives you Rust debugging in VS Code) or download the
`codelldb-x86_64-windows.vsix` asset from the [CodeLLDB GitHub releases](https://github.com/vadimcn/codelldb/releases)
and extract it to `C:\codelldb\`.

**CI:** downloads the latest CodeLLDB Windows VSIX and runs the full Rust smoke
suite (`smoke`, `smoke:session`, `smoke:multifile`).

**Limitation — program stdout not captured on Windows:** When codelldb runs in
stdio DAP mode (no VS Code terminal), it does not redirect the debuggee's stdout
to DAP `output` events. Program output is lost. Breakpoints, variables, watches,
and stepping all work correctly; only live stdout display is absent. This is a
codelldb architecture issue specific to headless/stdio operation.

## Attach (`dbg attach`) limitations

- **Very early breakpoints can race the attach.** Attach happens *after* the
  target process already exists (whether via `--pid` or `--name`'s
  `waitFor`), so a breakpoint on the first lines of `main()` can occasionally
  be missed if execution reaches that point before `setBreakpoints` completes
  against the newly-attached process. This is an OS/DAP-level limitation of
  attach in general, not something `dbg`'s UI can fully paper over.
- **By-name attach (`--name`) waits with no timeout, by design.** `waitFor`
  is inherently open-ended -- the whole point is that the target can be
  started whenever, from anywhere (VS Code, a shell, etc.) -- so
  `DebugSession.start()` deliberately skips its usual 20-second handshake
  guard for this path only. Cancel with the normal quit/Ctrl+C path at any
  time; `--pid` and `run` (launch) both keep the 20s guard since those are
  fast, adapter-local operations.
- **`lldb-dap`'s `waitFor` needs a brief moment to arm after the `attach`
  request is sent.** Confirmed empirically while building
  `scripts/attach-smoke-test.ts`: a target process spawned immediately after
  `dbg` reaches the `waiting` phase is reliably missed with no retry;
  spawning it even a couple seconds later is reliably caught. A human
  reacting to the "watching for X" status bar badge takes far longer than
  this window, so it's a non-issue in real use -- it only matters for
  anything scripting the attach flow tightly (see
  [TESTING.md](TESTING.md)).
- **`--name`'s process-matching semantics beyond an exact path aren't fully
  characterized.** `dbg attach --name <path>` resolves `<path>` to an
  absolute path (the same way `run`'s `--program` is resolved) before
  sending it as `attach`'s `program` field, since that's the only matching
  behavior this project has verified end-to-end. Whether `lldb-dap` also
  matches on a bare process name, a partial path, or handles symlinks/renamed
  binaries hasn't been explored.

## Open: TUI can still be scrolled out of, in some terminals

**Status: partially mitigated, not fully solved, and not fully diagnosed.**

The TUI renders full-screen via Ink's alternate-screen-buffer mode, the same
mechanism `vim`/`less`/`htop` use so quitting restores your shell exactly as
it was. That part works correctly and was verified directly (the
`\x1b[?1049h`/`\x1b[?1049l` enter/exit sequences do fire at the right
times).

The remaining gap is that **alternate-screen mode alone doesn't stop a
mouse-wheel/trackpad scroll gesture from doing something terminal-native**
while the app is running. Two layers are now sent from `src/tui/index.tsx`,
enabled right after entering the alt screen and disabled on every exit path
(normal quit, Ctrl+C/SIGTERM, and after `waitUntilExit()` resolves):

1. **DECSET 1007** ("alternate scroll mode", `\x1b[?1007h`/`l`) — a
   convenience some terminals implement that translates a scroll gesture
   into Up/Down arrow-key sequences instead of native scrollback. This
   alone turned out **not to be reliable**: it did not stop a trackpad
   two-finger scroll from escaping the app in Terminal.app (macOS default)
   in direct testing, even though the escape sequence was confirmed to be
   sent correctly. Whether a terminal honors an app-sent `1007` request at
   all is inconsistent — iTerm2, for example, requires the user to
   separately enable **Preferences → Advanced → "Scroll wheel sends arrow
   keys when in alternate screen mode"** (and turn *off* Preferences →
   Profiles → Terminal → "Disable save/restore alternate screen") before it
   honors it at all.
2. **SGR mouse tracking** (`\x1b[?1000h\x1b[?1006h` / disabled with
   `\x1b[?1000l\x1b[?1006l`) — the mechanism real full-screen terminal apps
   actually rely on (vim's `mouse=a`, htop, less, tmux, k9s). This isn't a
   translation the terminal might or might not choose to apply; enabling it
   makes the terminal hand every mouse/scroll event to this process as a raw
   escape sequence instead of acting on it at all, full stop. Ink has no
   mouse-event parsing, so those sequences just arrive as unrecognized
   `input` strings in `useInput` handlers and are silently ignored
   (confirmed: they parse as one opaque CSI sequence starting with `[<`,
   never as a recognized named key, so they can't collide with any
   single-key binding like `q` or `:`).

**Trade-off:** with mouse tracking enabled, normal click-drag text selection
inside the terminal stops working while this app is running (the terminal
hands clicks to the app instead of using them for selection). Most
terminals, Terminal.app and iTerm2 included, let you hold **Option** while
click-dragging to select text anyway, bypassing the app's mouse capture —
this is the standard, expected workaround and matches what other full-screen
terminal apps already require.

**Verification status:** both escape sequences were confirmed byte-for-byte
correct (fire in the right order, on every exit path) via a real
pseudo-terminal, and normal keyboard operation (navigation, quit) was
re-verified to still work after enabling mouse tracking. What could **not**
be verified from within this environment is the actual trackpad/mouse-wheel
gesture itself — `expect`-driven pseudo-terminals (see
[TESTING.md](TESTING.md)) don't generate real scroll input, so there is no
way to end-to-end confirm this from an automated test. If you still see
scrolling escape the app after this fix, that's a strong signal worth
reporting — the next thing to check would be whether the terminal in use
strips/ignores SGR mouse mode entirely (rare, but possible for a terminal
emulator with limited xterm compatibility), or whether there's a
distinction between how it reports two-finger trackpad gestures versus a
literal mouse wheel that neither `1007` nor `1000`/`1006` account for.

## Investigated, not confirmed as a real bug: input can stop responding under a scripted PTY

While stress-testing the fix above, rapid/scripted keystrokes sent through
an `expect`-driven pseudo-terminal sometimes caused the TUI to stop
responding to *any* key, including quit — reproduced down to a bare 10-line
Ink example with no relation to this codebase, and confirmed **not** to be
explained by real terminal I/O being slow (a raw Node `stdin.on('data', ...)`
listener on the identical pty delivered keystrokes correctly and instantly).
The leading suspicion is that this is specific to how `expect` allocates and
writes to its pty combined with Ink's `readable`-event-based (rather than
flowing-mode) stdin handling — not something a human typing at a real
keyboard in a real terminal session would trigger, since that would be an
extremely fundamental and immediately-obvious break in Node's terminal I/O
that essentially every Node CLI tool depends on.

This was **not fixed**, because the one fix attempted (removing
`CommandBar`'s `{ isActive: open }` gating) didn't resolve it and broke the
headless smoke test outright, so it was reverted back to the original
working implementation. If you ever see the real TUI (not the test harness)
stop responding to keys in actual use, that's a strong signal this is a real
bug after all and worth reopening — the debugging trail above (raw Node
`data` events vs. Ink's `readable`+`.read()` pattern) is the place to
resume from.

## Fixed, but worth remembering the failure mode

Two bugs this session belonged to the same root cause and are worth knowing
about if similar symptoms show up elsewhere in the codebase:

- **`Promise.race` doesn't cancel its losing branch.** Both the DAP
  handshake's 20-second timeout guard and `terminate()`'s 3-second
  disconnect guard used a bare `new Promise((resolve) =>
  setTimeout(resolve, ms))` raced against the real operation. The `setTimeout`
  handle from the *losing* side kept running even after the race resolved,
  and a live timer keeps Node's event loop — and therefore the whole
  process — alive until it fires. This made the TUI's `q` quit *look*
  instant (Ink exits the alt screen right away) while the underlying process
  silently lingered for up to 20 seconds before the terminal actually
  returned control. Fixed by explicitly capturing and `clearTimeout`-ing the
  handle once the race settles, in both `DebugSession.start()` and
  `DebugSession.terminate()`.
- **A killed child process's stale event listeners can corrupt a
  *replacement* session's state.** `DebugSession.restart()` kills the old
  adapter process before starting a new one; without detaching the old
  child's `exit` listener first, its delayed `'exit'` event fired *after*
  the new adapter was already live and flipped it into `error`, since
  nothing marked that particular exit as expected. Fixed by calling
  `child.removeAllListeners('exit'|'error')` before killing it in
  `restart()`.
