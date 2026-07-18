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
> `lldb-dap` can debug multiple native languages, and this POC now includes
> additional fixtures for Rust, C, and C++. See [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) for the full
> list of current limitations.

## Quick start

Prerequisites: Node.js, Xcode Command Line Tools (for `lldb-dap`), and a Rust
toolchain (only needed to build the bundled verification fixtures).

```bash
npm install

# build the fixture binaries dbg debugs by default
npm run build:fixtures
```

**Electron app:**

```bash
npm run dev:fixture
```

**Terminal UI:**

```bash
npm run tui:fixture
```

Both launch against `fixtures/loop-demo` by default — a small Rust program
with a loop, a `Vec`, and two helper functions, purpose-built to exercise
breakpoints, stepping, call-stack navigation, and variable/`Vec` expansion.

This project now also includes second fixtures in `fixtures/c-loop` and
`fixtures/cpp-loop` to verify C and C++ debugging with the same DAP frontend.

To point either frontend at your own program instead of the fixture:

```bash
npm run dev -- run --adapter lldb-dap --program <path-to-binary> --source <path-to-source>
npm run tui -- run --adapter lldb-dap --program <path-to-binary> --source <path-to-source>
```

(`--source` defaults to `<cwd>/src/main.rs` if omitted; `--adapter` defaults
to `lldb-dap`, the only adapter currently implemented.)

## Documentation

| Doc | Covers |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the engine, IPC, shared UI layer, and both frontends fit together |
| [docs/KEYBINDINGS.md](docs/KEYBINDINGS.md) | Full keybinding reference for both frontends, and why they intentionally differ |
| [docs/TESTING.md](docs/TESTING.md) | The headless smoke-test suite and the verification discipline used throughout this project |
| [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) | Current limitations — single-adapter support, TUI terminal-scroll caveat, etc. |
| [docs/USER_FLOWS.md](docs/USER_FLOWS.md) | Proposed (not yet implemented) flows for multi-file projects and attaching to externally-started processes |
| [docs/MONETIZATION.md](docs/MONETIZATION.md) | Working notes on whether/how this could become more than an OSS side project |

## Project structure

```
src/
├── shared/
│   ├── types.ts        # SessionSnapshot, DAP-derived types, IPC channel constants
│   └── ui/              # DOM-agnostic state + logic shared by both frontends
│       ├── useDbgStore.ts     # zustand: session snapshot, output, DAP log
│       ├── useUiStore.ts      # zustand: focus, cursor, selection, command bar
│       ├── keybindings.ts     # single source of truth for each frontend's key labels
│       ├── flattenVariables.ts
│       └── phaseMessages.ts
├── engine/               # Zero Electron/Ink imports -- reusable by either frontend
│   ├── dap/              # DAP transport: Content-Length framing, request/response client
│   ├── adapters/         # Per-DAP-server config (currently just lldb-dap)
│   └── session/
│       └── DebugSession.ts    # The orchestration state machine both frontends drive
├── main/                 # Electron main process: CLI parsing, BrowserWindow, IPC
├── preload/               # contextBridge-exposed window.dbg API
├── renderer/src/           # Electron React UI (Tailwind CSS)
└── tui/                    # Ink terminal UI

fixtures/loop-demo/         # Rust verification fixture (cargo new --bin)
scripts/                     # Headless smoke tests (see docs/TESTING.md)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for what each layer actually
does and how a debug session flows through it end to end.
