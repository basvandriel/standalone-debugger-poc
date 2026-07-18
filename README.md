# dbg

A universal, editor-agnostic debugging frontend built on the [Debug Adapter
Protocol](https://microsoft.github.io/debug-adapter-protocol/) (DAP), in the
spirit of [lazygit](https://github.com/jesseduffield/lazygit) and
[k9s](https://k9scli.io/): dense, keyboard-first panels instead of a
mouse-driven IDE layout.

One shared engine (`src/engine/`, `src/shared/`) drives **two** interchangeable
frontends:

- **Electron app** — a VS Code-style GUI with F-key bindings, Tailwind CSS,
  Shiki syntax highlighting.
- **Terminal UI** — an [Ink](https://github.com/vadimdemedes/ink)-based
  full-screen TUI with k9s/lazygit-style vim bindings, for when you live in a
  terminal and don't want to leave it.

Both talk to the exact same `DebugSession` engine class, so behavior (the DAP
handshake, breakpoints, stepping, watches, restart-after-exit, clean shutdown)
is identical between them — only the rendering and keybindings differ.

> **Status: proof of concept.** Only one adapter is wired up: **`lldb-dap`**.
> `lldb-dap` can debug multiple native languages (Rust, C, C++). See
> [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) for current limitations.

## Quick start

Prerequisites: Node.js, Xcode Command Line Tools (for `lldb-dap`), and a Rust
toolchain (only needed to build the bundled verification fixtures).

```bash
npm install
npm run build:fixtures
```

**Terminal UI** (recommended for first try):

```bash
npm run tui:fixture
```

**Electron app:**

```bash
npm run dev:fixture
```

Both launch against `fixtures/loop-demo` — a small Rust program with a loop, a
`Vec`, and two helper functions, purpose-built to exercise breakpoints, stepping,
call-stack navigation, and variable expansion.

## Debugging your own program

Point either frontend at any compiled binary:

```bash
# Terminal UI
npm run tui -- run --program <path-to-binary> --source <path-to-source-file>

# Electron app
npm run dev -- run --program <path-to-binary> --source <path-to-source-file>
```

`--source` defaults to `<cwd>/src/main.rs` if omitted. `--adapter` defaults to
`lldb-dap`, the only adapter currently implemented.

## Multi-file projects

dbg handles multi-file projects with no config needed.

**The source panel follows execution automatically.** When the program stops at a
breakpoint in a different file than what's on screen, the panel switches to that
file on its own — you don't have to navigate there.

**To set a breakpoint in a file you haven't visited yet**, use the fuzzy file
switcher. At startup, dbg scans the directory tree next to your `--source` file
and builds a candidate list immediately — all your source files are available to
jump to before you've run anything.

| Frontend | Open switcher | Navigate | Select |
|---|---|---|---|
| TUI | `f` | `j` / `k` or arrow keys | Enter |
| Electron | `Ctrl+P` / `Cmd+P` | arrow keys | Enter |

**Typical flow for a multi-file project (TUI):**

```
npm run tui:fixture:multi
```

1. Press `f`, type `report`, Enter → jumps to `report.rs`
2. `j`/`k` to the line you want, press `b` → breakpoint set
3. Press `f`, type `main`, Enter → back to `main.rs`
4. Press `c` to run → panel auto-follows to `report.rs` when it stops there

## Attaching to a process started elsewhere

Instead of launching the program yourself, you can arm dbg first and then start
the program however you normally would — from another terminal, VS Code's Run
button, a shell script, anything.

**Attach by process name** (most common):

```bash
npm run tui -- attach --name <path-to-binary>
```

dbg opens immediately showing a `WATCHING` badge and waits. Start your program
however you like. The moment a matching process appears, dbg attaches — the
badge flips to `READY`, breakpoints and stepping work exactly as they do after a
normal `run`.

**Attach by PID** (when the process is already running):

```bash
npm run tui -- attach --pid <pid>
```

Both `--name` and `--pid` also work with the Electron app (`npm run dev --`
instead of `npm run tui --`).

**`--source` is optional for attach.** If you know the entry file you can pass
it; if you don't, leave it out — the source panel starts empty and fills in the
moment the first stop tells dbg which file it's in.

**Try it with the bundled fixture:**

```bash
# Terminal 1 — arm dbg first
npm run tui:fixture:attach

# Terminal 2 — start the program whenever you're ready
./fixtures/attach-demo/target/debug/attach-demo
```

The `WATCHING` badge in terminal 1 flips to `READY` the instant the process
appears. No coordination needed beyond running dbg before starting the binary.

> **One caveat:** breakpoints set before attaching can occasionally be missed
> for code that runs in the very first milliseconds of `main()`. This is an
> OS/DAP-level limitation of attach in general — if you need a breakpoint on
> the first line of `main`, use `run` instead of `attach`.

## Keybindings (TUI)

| Key | Action |
|---|---|
| `c` | Continue / start |
| `n` | Step over |
| `s` | Step into |
| `o` | Step out |
| `b` | Toggle breakpoint on current line |
| `f` | Open file switcher |
| `j` / `k` | Move cursor down / up |
| `h` / `l` | Collapse / expand variable |
| `w` | Add watch expression |
| `x` | Remove watch |
| `r` | Restart session |
| `q` | Quit |

See [docs/KEYBINDINGS.md](docs/KEYBINDINGS.md) for the full reference including
Electron F-key bindings.

## Other fixtures

```bash
npm run tui:fixture:c          # C program
npm run tui:fixture:cpp        # C++ program
npm run tui:fixture:multi      # Rust, three source files (main.rs / ops.rs / report.rs)
npm run tui:fixture:attach     # Attach flow demo (start the binary separately)
```

Electron equivalents use `dev:` instead of `tui:`.

## Documentation

| Doc | Covers |
|---|---|
| [docs/USER_FLOWS.md](docs/USER_FLOWS.md) | Multi-file source-follow + fuzzy switcher, and `dbg attach` — design rationale and how to try each |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the engine, IPC, shared UI layer, and both frontends fit together |
| [docs/KEYBINDINGS.md](docs/KEYBINDINGS.md) | Full keybinding reference for both frontends |
| [docs/TESTING.md](docs/TESTING.md) | Headless smoke-test suite and verification discipline |
| [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) | Current limitations and honest caveats |

## Project structure

```
src/
├── shared/
│   ├── types.ts             # SessionSnapshot, DAP-derived types, IPC channel constants
│   └── ui/                  # DOM-agnostic state + logic shared by both frontends
│       ├── useDbgStore.ts        # zustand: session snapshot, output, DAP log
│       ├── useUiStore.ts         # zustand: focus, cursor, active/known source files, file switcher
│       ├── keybindings.ts        # single source of truth for each frontend's key labels
│       ├── fuzzyMatch.ts         # file switcher's fuzzy filter/scoring
│       ├── flattenVariables.ts
│       └── phaseMessages.ts
├── engine/                  # Zero Electron/Ink imports — reusable by either frontend
│   ├── dap/                 # DAP transport: Content-Length framing, request/response client
│   ├── adapters/            # Per-DAP-server config (currently just lldb-dap)
│   ├── workspace/
│   │   └── listSourceFiles.ts    # Bounded directory scan seeding the fuzzy file switcher
│   └── session/
│       └── DebugSession.ts       # The orchestration state machine both frontends drive
├── main/                    # Electron main process: CLI parsing, BrowserWindow, IPC
├── preload/                 # contextBridge-exposed window.dbg API
├── renderer/src/            # Electron React UI (Tailwind CSS)
└── tui/                     # Ink terminal UI

fixtures/loop-demo/          # Rust fixture: loop, Vec, helper functions
fixtures/c-loop/             # C fixture
fixtures/cpp-loop/           # C++ fixture
fixtures/multi-file-demo/    # Rust fixture spanning main.rs / ops.rs / report.rs
fixtures/attach-demo/        # Rust fixture for the dbg attach flow
scripts/                     # Headless smoke tests (see docs/TESTING.md)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how a debug session flows
through the engine end to end.
