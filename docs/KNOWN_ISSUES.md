# Known issues & limitations

## Scope limitations (by design, not bugs)

- **Only one DAP adapter is wired up: Rust via `lldb-dap`.** The
  `AdapterDefinition` interface (`src/engine/adapters/types.ts`) exists
  specifically so other adapters (debugpy, delve, codelldb, ...) can be
  added without touching the transport layer, but none currently are.
- **Rust `Vec` pretty-printing quality depends on the local LLVM/lldb
  build.** If a `Vec<T>` shows raw `RawVec` internals instead of `[1, 2, 3]`,
  that's a gap in the locally installed lldb's Rust formatters, not a bug in
  `DebugSession` or the DAP client.
- **The TUI has no mouse/click support.** Ink doesn't provide native mouse
  handling, and this matches k9s/lazygit's keyboard-first philosophy rather
  than being an oversight — see [KEYBINDINGS.md](KEYBINDINGS.md) for the
  full keyboard-only interaction model.

## Open: TUI can still be scrolled out of, in some terminals

**Status: partially mitigated, not fully solved, and not fully diagnosed.**

The TUI renders full-screen via Ink's alternate-screen-buffer mode, the same
mechanism `vim`/`less`/`htop` use so quitting restores your shell exactly as
it was. That part works correctly and was verified directly (the
`\x1b[?1049h`/`\x1b[?1049l` enter/exit sequences do fire at the right
times).

The remaining gap is that **alternate-screen mode alone doesn't stop a
mouse-wheel/trackpad scroll gesture from doing something terminal-native**
while the app is running. xterm and xterm-compatible terminals have a
*separate* mode for this — DECSET **1007**, "alternate scroll mode" — which
translates a scroll gesture into Up/Down arrow-key sequences instead of
native scrollback while the alt screen is active. `src/tui/index.tsx` now
sends `\x1b[?1007h` right after entering the alt screen and `\x1b[?1007l` on
every exit path (normal quit, Ctrl+C/SIGTERM, and after `waitUntilExit()`
resolves) — this is exactly what k9s, vim, and tmux themselves send.

**Why that might not be enough:** whether a terminal actually *honors* an
app-sent `1007` sequence is inconsistent across terminals:

- **iTerm2** requires the user to separately enable **Preferences → Advanced
  → "Scroll wheel sends arrow keys when in alternate screen mode"**, and
  also requires **Preferences → Profiles → Terminal → "Disable save/restore
  alternate screen"** to be turned *off*. Without that preference enabled,
  iTerm2 does not honor the app's `1007` request at all, regardless of what
  the app sends.
- Whether **Terminal.app** supports this feature at all was not confirmed —
  the evidence found so far is specific to iTerm2/xterm/Konsole.
- This was investigated but **not verified against a real interactive
  terminal session** — everything in this repo's test suite runs through
  `expect`-driven pseudo-terminals (see [TESTING.md](TESTING.md)), which
  don't generate real mouse-wheel/trackpad scroll events at all, so the
  actual fix could not be end-to-end verified from within this environment.

**If you hit this:** check which terminal you're using and whether the
relevant preference is enabled (iTerm2, above). If it still happens with
that preference on, or in a terminal that has no equivalent preference,
that's a genuine gap worth revisiting — possibly worth detecting the
terminal type and warning the user, or documenting a per-terminal
workaround table here once more terminals have actually been tested against.

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
