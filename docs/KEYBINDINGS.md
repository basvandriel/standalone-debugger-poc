# Keybindings

Both frontends are keyboard-first — no menu bar, no toolbar buttons are
required for any action. They use **different physical keys** on purpose:
the Electron app follows VS Code's F-key debug bindings, the TUI follows
k9s/lazygit-style vim letters. This isn't an oversight; see
[Why they differ](#why-they-differ) below.

## Single source of truth

Every key shown below is defined exactly once, in
[`src/shared/ui/keybindings.ts`](../src/shared/ui/keybindings.ts), as two
plain objects: `ELECTRON_KEYS` and `TUI_KEYS`. Both the input handlers
(`useKeybindings.ts` / `useTuiKeybindings.ts`) and the status-bar hint text
in both frontends read from these constants rather than hardcoding a literal
key string. This exists because of a real bug: the "press F5 to begin"
placeholder text was hardcoded and shared between both frontends, so it
showed the wrong key in the TUI. If you need to change or add a key, change
it in `keybindings.ts` — nowhere else should contain a literal key string.

## Electron

| Action | Key |
|---|---|
| Start / continue execution, or restart after exit | `F5` |
| Stop (close window) | `⇧F5` |
| Toggle breakpoint at cursor | `F9` |
| Step over | `F10` |
| Step into | `F11` |
| Step out | `⇧F11` |
| Open command bar | `:` |
| Cycle focused panel | `Tab` / `⇧Tab` |

Panel-scoped (act on whichever panel is currently focused):

| Panel | Keys |
|---|---|
| Source | `↑`/`↓` move cursor (for breakpoint targeting) |
| Call Stack | `↑`/`↓` select frame |
| Variables | `↑`/`↓` move, `→`/`⏎` expand, `←` collapse |
| Watch | `↑`/`↓` move, `Delete` remove |
| Console | `←`/`→` switch tab (program output / DAP log) |

Global keys (`F5`/`F9`/`F10`/`F11`/`:`) work regardless of which panel is
focused. A text-input guard in `useKeybindings.ts` disables all single-key
handling while `document.activeElement` is an input/textarea, so typing in
the command bar doesn't also trigger F-key actions.

## TUI

| Action | Key |
|---|---|
| Start / continue execution, or restart after exit | `c` |
| Quit (terminates the session first) | `q` |
| Toggle breakpoint at cursor | `b` |
| Step over | `n` |
| Step into | `s` |
| Step out | `o` |
| Open command bar | `:` |
| Cycle focused panel | `Tab` / `⇧Tab` |
| Collapse/expand focused panel | `z` |

Panel-scoped (`j`/`k`/`h`/`l` and arrow keys are interchangeable everywhere):

| Panel | Keys |
|---|---|
| Source | `j`/`k` move cursor |
| Call Stack | `j`/`k` select frame |
| Variables | `j`/`k` move, `l`/`Enter` expand, `h` collapse |
| Watch | `j`/`k` move, `x`/`Delete` remove |
| Console | `h`/`l` switch tab |

## Command bar (both frontends)

Opened with `:` in either frontend, closed with `Escape` or after a command
runs:

| Command | Effect |
|---|---|
| `watch <expr>` | Add a watch expression, re-evaluated on every stop/step |
| `bp <line>` | Toggle a breakpoint on that line of the current source file |
| `quit` / `q` | Terminate the session and exit |

## Why they differ

Ink's `Key` type has **no F-key fields at all**, and even where F-keys work
in a terminal, `Shift+F-key` combinations are unreliable across
terminals/tmux/SSH — so the TUI genuinely cannot offer the exact same
bindings as the Electron app. k9s and lazygit both use letter keys for
exactly this reason. The fix isn't to force one scheme onto both frontends;
it's making sure the two schemes can't silently drift apart from what their
own status bar/help text claims — which is what `keybindings.ts` does.
