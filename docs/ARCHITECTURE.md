# Architecture

## Layering

```
┌─────────────────────────────┐  ┌─────────────────────────────┐
│   Electron renderer (React)  │  │      TUI (Ink + React)       │
│   src/renderer/src/          │  │      src/tui/                │
└──────────────┬───────────────┘  └──────────────┬───────────────┘
               │ IPC (contextBridge)              │ direct calls
┌──────────────▼───────────────┐                  │
│   Electron main process       │                  │
│   src/main/, src/preload/     │                  │
└──────────────┬───────────────┘                  │
               │                                    │
               └───────────────┬────────────────────┘
                                │
                  ┌─────────────▼─────────────┐
                  │      DebugSession           │   src/engine/session/
                  │   (state machine, no        │
                  │    Electron/Ink imports)     │
                  └─────────────┬─────────────┘
                                │
                  ┌─────────────▼─────────────┐
                  │        DapClient             │   src/engine/dap/
                  │  (Content-Length framing,   │
                  │   request/response, events)  │
                  └─────────────┬─────────────┘
                                │ stdio
                  ┌─────────────▼─────────────┐
                  │         lldb-dap              │
                  └───────────────────────────┘
```

The rule that makes two frontends possible without duplicating logic:
**`src/engine/` never imports `electron` or `ink`.** It takes and returns
plain data. The Electron main process wraps it in IPC; the TUI calls it
directly. `src/shared/ui/` extends that same rule one layer up — DOM-agnostic
state and pure functions used by both renderers' components.

## The DAP engine (`src/engine/`)

### `dap/` — transport layer

- **`DapMessageStream.ts`** — encodes/decodes the DAP wire format
  (`Content-Length: N\r\n\r\n<json>`). The decoder buffers partial reads and
  handles multiple messages arriving in one chunk (both routine over a child
  process pipe). The encoder uses `Buffer.byteLength(json, 'utf8')`, not
  `.length` — the length must be byte-accurate, not character-accurate.
- **`DapClient.ts`** — hand-written (no adequate lightweight client library
  exists; `@vscode/debugprotocol` is types-only). Takes `Readable`/`Writable`
  streams rather than a `ChildProcess`, so it's decoupled from how the
  adapter was spawned. Tracks a `seq` counter and a `pending` map for
  request/response correlation, and re-emits every DAP event by name
  (`client.on('stopped', ...)`) plus a catch-all `'*'` for the DAP-log panel.
  Contains zero lldb-dap-specific logic, so it's reusable against any other
  DAP server.
- **`spawnAdapter.ts`** — thin `child_process.spawn` wrapper.

### `adapters/` — per-server configuration

`AdapterDefinition` (`types.ts`) is the extension point for adding another
DAP server later (debugpy, delve, codelldb, ...) without touching the
transport layer: `resolveExecutable()`, `spawnArgs`, `buildLaunchArgs()`.
`lldbDap.ts` is the only implementation today — it resolves the executable
via `xcrun -f lldb-dap` (caching the result, falling back to the known
CommandLineTools path), and needs no spawn args since argument-less
invocation defaults to stdio DAP mode.

### `session/DebugSession.ts` — the orchestration state machine

The class both frontends drive. Public API is plain async methods with no
Electron/Ink types: `start()`, `restart()`, `toggleBreakpoint(file, line)`,
`beginExecution()`, `continueExecution()`, `stepOver/stepIn/stepOut()`,
`selectFrame(id)`, `expandVariable(ref)`, `addWatch/removeWatch()`,
`terminate()`, plus push-style subscriptions: `onSnapshot`, `onOutput`,
`onDapLog`.

**Phase model:** `idle → initializing → configuring → running ⇄ stopped →
terminated`, with `error` reachable from most states. `configuring` is the
"adapter is up, breakpoints can be set, waiting for the user to press
start" phase; `running`/`stopped` alternate as the program executes and hits
breakpoints.

**The handshake** (`runHandshake()`), guarded by a 20-second timeout raced
against it:

1. Resolve + spawn `lldb-dap` (no args, stdio mode).
2. Send `initialize` and await the response.
3. Send `launch` (**do not await the response** — lldb-dap only lets this
   settle after `configurationDone`) and race waiting for the `initialized`
   event against the (never-resolving-on-success) launch response promise.
4. `phase = 'configuring'`. Breakpoint toggles send `setBreakpoints` with
   the **full line set for that file** each time — DAP replaces the set,
   it doesn't diff it.
5. `beginExecution()` sends `configurationDone` → `phase = 'running'`.
6. A `stopped` event triggers `threads` → `stackTrace` → scopes for frame 0
   → top-level variables → re-evaluation of every watch expression →
   `phase = 'stopped'`.
7. Step commands (`next`/`stepIn`/`stepOut`) only acknowledge acceptance;
   the actual state refresh happens when the follow-up `stopped` event
   arrives, same as step 6 — never refresh immediately after the request
   resolves.
8. `exited` → `terminated` → `phase = 'terminated'`.

**`restart()`** re-runs the handshake from scratch once the previous session
has actually ended (`terminated`/`error`). It kills the old adapter process
first — **detaching its `exit`/`error` listeners before killing it**, since
otherwise the old process's delayed exit event fires after the new session
is already live and clobbers it back into `'error'` (a real bug found while
implementing this — see [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for the general
class of bug this belongs to). Breakpoint *line numbers* survive a restart
(`breakpointLines`, keyed by file) and get re-applied to the fresh adapter
process once it reaches `configuring` again; the old verified/id descriptors
don't survive, since they belonged to a now-dead process.

**Shutdown discipline:** `terminate()` sends `disconnect
{terminateDebuggee: true}` raced against a timeout, then disposes the
client and kills the child if it's still alive — this is what the
zombie-process check in [TESTING.md](TESTING.md) verifies. Both this timeout
and the handshake timeout mentioned above use a `setTimeout` handle that is
**explicitly cleared** once the race settles, regardless of which side won —
`Promise.race` never cancels the losing branch, and a live timer keeps
Node's whole event loop (and thus the process) alive until it fires. Getting
this wrong here specifically made TUI shutdown hang for up to 20 seconds
after pressing quit; see [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

## The shared UI layer (`src/shared/ui/`)

DOM-agnostic state and pure logic, imported by both `src/renderer/` and
`src/tui/`:

- **`useDbgStore.ts`** — zustand store holding the latest `SessionSnapshot`,
  plus rolling `output`/`dapLog` buffers (capped at 500 entries each).
- **`useUiStore.ts`** — zustand store for everything that's purely a UI
  concern and not part of the debug session itself: which panel is focused,
  keyboard cursor line, selected variable/watch index, which
  `variablesReference`s are expanded, command-bar open/value state, which
  panels are collapsed.
- **`flattenVariables.ts`** — turns the scope/variable tree into a flat list
  of visible rows for `j`/`k`-style navigation. Row keys are
  `${parentKey}/${siblingIndex}:${name}`, not just `${parentKey}/${name}` —
  DAP variable listings routinely contain multiple same-named siblings (e.g.
  several `<null>` fields), so the name alone isn't a unique React key.
- **`phaseMessages.ts`** — the "no data yet" placeholder text shown in
  Call Stack/Variables panels before a session is running. Takes the
  frontend's own start-key label as a parameter (`'F5'` vs `'c'`) rather
  than hardcoding one, specifically so this text can't drift out of sync
  with either frontend's actual keybinding again (it already did once).
- **`keybindings.ts`** — see [KEYBINDINGS.md](KEYBINDINGS.md).

## Electron frontend (`src/main/`, `src/preload/`, `src/renderer/`)

- **`main/cli.ts`** — parses `dbg run --adapter ... --program ... --source
  ... --cwd ...` via Node's built-in `util.parseArgs`. Validation failures
  print usage and exit before any `BrowserWindow` is created.
- **`main/index.ts`** — bootstraps: parses CLI args, creates the
  `BrowserWindow` (`contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`), constructs the `DebugSession`, registers IPC handlers,
  and waits for a renderer-ready signal before calling `session.start()` so
  no early snapshot/output events are lost. `window-all-closed` terminates
  the session before quitting, so closing the window can't leave an
  orphaned adapter process.
- **`main/ipc.ts`** — one `ipcMain.handle` per `DebugSession` method, plus
  forwarding `session.onSnapshot/onOutput/onDapLog` straight through to
  `webContents.send` — push, not poll, since DAP is inherently event-driven
  and the session already emits ready-to-forward data.
- **`preload/index.ts`** — exposes a narrow `window.dbg` API via
  `contextBridge`. Channel name constants live in `src/shared/types.ts`
  (`IPC.*`) so preload and main can't drift apart.
- **`renderer/src/`** — React components, Tailwind v4 (`styles/theme.css`
  defines the color/radius/shadow/font design tokens), Shiki syntax
  highlighting (`lib/highlightSource.ts`). `App.tsx` owns the IPC
  subscriptions and the source-file loading/highlighting effect;
  `hooks/useKeybindings.ts` is one global `keydown` listener with a
  text-input guard (skips single-key handling when
  `document.activeElement` is an input/textarea, so typing in the command
  bar doesn't also trigger F-key actions).

## TUI frontend (`src/tui/`)

Built on [Ink](https://github.com/vadimdemedes/ink) (React reconciled onto
terminal cells via Yoga flexbox) instead of the DOM. Structurally it mirrors
the Electron renderer closely (same store subscriptions, same panel
ordering, same 3:2 source/side-column ratio) but everything below is a
consequence of the terminal having no native scroll, no mouse, and fixed
character-cell dimensions.

- **`index.tsx`** — the entry point. Renders with `alternateScreen: true`
  (so quitting restores the shell exactly as it was) and additionally sends
  the xterm "alternate scroll mode" escape sequence (`\x1b[?1007h` /
  `\x1b[?1007l` on exit) — without it, some terminals let a mouse-wheel
  scroll fall through to native scrollback instead of being translated into
  arrow-key events. See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for why this
  isn't a complete guarantee across every terminal.
- **`hooks/useTuiKeybindings.ts`** — one `useInput` hook implementing
  k9s/lazygit-style letter bindings. Reads `useUiStore.getState()` live
  inside the handler rather than closing over render-time state, which
  matters under rapid keystrokes.
- **`components/PanelFrame.tsx`** — the generic bordered-box shell
  (`borderStyle="round"`) every data panel wraps itself in.
- **`components/CommandBar.tsx`** — gated with Ink's `useInput(...,
  { isActive: open })` rather than an internal early-return guard. This
  looks like unnecessary churn (the hook's raw-mode effect mounts/unmounts
  every time the bar opens/closes) and was in fact rewritten once to remove
  it — that rewrite broke the headless smoke test outright, so it was
  reverted. Leave this pattern as-is unless you can reproduce the failure
  it's guarding against and verify a change against both the smoke suite
  and a real terminal.
- **`lib/layoutBudget.ts`** — computes exact row counts for every panel up
  front (source content rows, each side panel's rows, console rows) from
  the terminal's actual row count, rather than letting Yoga distribute
  space and trying to measure the result afterward. Every bordered panel
  costs `PANEL_TITLE_ROWS + BORDER_ROWS` (1 + 2 = 3) of fixed chrome on top
  of its content — Yoga sizes a `borderStyle` box's border as *additional*
  height, not eaten from the children, so this must be subtracted
  explicitly everywhere a "total panel height" is budgeted. Getting this
  wrong is exactly what caused the TUI to overflow its terminal and scroll;
  see [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
- **`lib/visibleWindow.ts`** — the scroll-window math for virtualized lists
  (source lines, call stack, variables, watches, output/DAP log) — the
  terminal has no native clipping/scroll, so each panel only ever renders
  the rows that currently fit, computed from the selected/current index and
  the panel's content-row budget.
- **`lib/highlightSourceTokens.ts`** — Shiki syntax highlighting, but
  emitting token arrays (`{content, color}[]`) instead of HTML, since
  there's no DOM to `dangerouslySetInnerHTML` into.
- **`components/Spinner.tsx`** — a small frame-cycling braille spinner used
  only for the `initializing` phase badge. Its `setInterval` is always
  cleared on unmount — see the shutdown-timer note above; this is the same
  class of bug in miniature; getting the cleanup wrong here wouldn't hang
  shutdown (the component always unmounts eventually) but would leak a
  timer for the app's lifetime otherwise.

## Design tokens

Electron: `src/renderer/src/styles/theme.css`, a Tailwind v4 `@theme` block
— a 3-level surface scale (`bg`/`panel`/`panel-header`), `--radius-sm/md/lg`,
`--shadow-panel`/`--shadow-elevated`, and a `--font-sans` layered over the
existing `--font-mono` (sans for UI chrome — panel titles, status bar labels,
hints; mono stays for all code/data content). `src/renderer/src/components/icons.tsx`
holds ~9 hand-authored inline SVG icons (no icon-library dependency).

TUI: `src/tui/theme.ts`'s `COLORS` object is deliberately kept in sync with
the Electron palette (documented in its own header comment) — same hex
values, extended with fill colors (`panelHeader`, `*Dim` variants for badge
backgrounds) since Ink `Box` supports `backgroundColor` the same way CSS
does. Rounded corners and shadows have no terminal equivalent; the
closest available moves are `borderStyle="round"` box-drawing characters
and filled badge backgrounds instead of flat colored text.
