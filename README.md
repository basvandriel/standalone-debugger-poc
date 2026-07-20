# dbg

[![CI](https://github.com/basvandriel/standalone-debugger-poc/actions/workflows/ci.yml/badge.svg)](https://github.com/basvandriel/standalone-debugger-poc/actions/workflows/ci.yml)
![Rust](https://img.shields.io/badge/Rust-supported-orange?logo=rust)
![C/C++](https://img.shields.io/badge/C%2FC%2B%2B-supported-blue?logo=cplusplus)
![Python](https://img.shields.io/badge/Python-supported-yellow?logo=python)
![macOS](https://img.shields.io/badge/macOS-supported-lightgrey?logo=apple)
![Linux](https://img.shields.io/badge/Linux-supported-lightgrey?logo=linux)
![Windows](https://img.shields.io/badge/Windows-supported-lightgrey?logo=windows)

**A standalone, editor-agnostic debugger.** Breakpoints, stepping, variable inspection, watches, and multi-file follow — without an IDE.

Inspired by [lazygit](https://github.com/jesseduffield/lazygit) and [k9s](https://k9scli.io/). Dense, keyboard-first panels. Works over SSH. No Electron required.

---

![dbg demo](demo/demo.gif)

---

## Features

- **Breakpoints** — set and clear per-line across any file in your project, before execution starts
- **Stepping** — step over, step into, step out; source panel follows automatically
- **Variable inspection** — expandable tree view with live values at every stop
- **Watch expressions** — evaluate arbitrary expressions, auto-refreshed on each stop
- **Multi-file follow** — source panel switches files automatically as execution moves between them
- **Fuzzy file switcher** — jump to any source file and set breakpoints ahead of execution
- **Process attach** — arm dbg first, start your program anywhere, dbg attaches the moment it appears
- **Restart** — re-run without restarting dbg or re-configuring breakpoints
- **Two frontends, one engine** — TUI (terminal) and Electron (GUI) share the exact same debug session logic

## Language support

| Language | Adapter | Notes |
|---|---|---|
| Rust | `lldb-dap` | Full NatVis/type formatting via CodeLLDB on Windows |
| C | `lldb-dap` | |
| C++ | `lldb-dap` | |
| Python | `debugpy` | Stdout captured via DAP; `pip install debugpy` required |

## Quick start

**Prerequisites:** Node.js 22+, and the adapter for your language:

| Language | Prerequisite |
|---|---|
| Rust / C / C++ | Xcode Command Line Tools (macOS) · `lldb` package (Linux) |
| Python | `pip install debugpy` |

```bash
git clone https://github.com/basvandriel/standalone-debugger-poc
cd standalone-debugger-poc
npm install
npm run build:fixtures       # builds the bundled Rust/C/C++ demo programs
```

**Terminal UI (recommended):**

```bash
npm run tui:fixture          # Rust loop-demo
npm run tui:fixture:python   # Python loop-demo
npm run tui:fixture:multi    # Rust, three source files
npm run tui:fixture:c        # C
npm run tui:fixture:cpp      # C++
```

**Electron GUI:**

```bash
npm run dev:fixture
```

## Debug your own program

```bash
# Rust / C / C++
npm run tui -- run --program path/to/binary --source path/to/main.rs

# Python
npm run tui -- run --adapter debugpy --program path/to/script.py --source path/to/script.py

# Attach to a running process
npm run tui -- attach --name path/to/binary   # waits until the process appears
npm run tui -- attach --pid 12345             # attaches immediately
```

## Keybindings

| Key | Action |
|---|---|
| `c` | Continue / start execution |
| `n` | Step over |
| `s` | Step into |
| `o` | Step out |
| `b` | Toggle breakpoint on current line |
| `f` | Open fuzzy file switcher |
| `j` / `k` | Move cursor down / up |
| `l` / `h` | Expand / collapse variable |
| `Tab` / `Shift+Tab` | Cycle focus between panels |
| `z` | Fold / unfold panel |
| `:w <expr>` | Add watch expression |
| `x` | Remove selected watch |
| `r` | Restart session |
| `q` | Quit |

Full reference including Electron F-key bindings: [docs/KEYBINDINGS.md](docs/KEYBINDINGS.md)

## Multi-file projects

The source panel follows execution automatically. When the program stops in a different file, the panel switches there on its own.

**To set a breakpoint in a file you haven't visited yet:** press `f`, type part of the filename, Enter — dbg pre-scans your source tree at startup so every file is reachable before execution starts.

```bash
npm run tui:fixture:multi
# f → type "report" → Enter → navigate to the line → b → f → type "main" → Enter → c
```

## Process attach

```bash
# Terminal 1 — arm dbg, it shows WATCHING and waits
npm run tui:fixture:attach

# Terminal 2 — start the process whenever you're ready
./fixtures/attach-demo/target/debug/attach-demo
```

The moment the process appears, dbg attaches and the badge flips to READY.

## Architecture

One engine, two frontends:

```
src/
├── engine/
│   ├── dap/          # Content-Length framing, DapClient request/response
│   ├── adapters/     # lldb-dap, debugpy — each resolves its executable and
│   │                 # builds adapter-specific launch/attach args
│   ├── workspace/    # bounded directory scan for the fuzzy file switcher
│   └── session/
│       └── DebugSession.ts   # the state machine both frontends drive
├── shared/
│   ├── types.ts      # SessionSnapshot and all shared types
│   └── ui/           # Zustand stores, keybindings, fuzzy match — no DOM/Ink imports
├── tui/              # Ink terminal UI
├── renderer/         # Electron React UI (Tailwind + Shiki)
├── main/             # Electron main process, CLI parsing, IPC
└── preload/          # contextBridge window.dbg API
```

The `DebugSession` class handles the full DAP lifecycle: spawning the adapter, handshaking, breakpoints, stepping, watching, restart, and clean shutdown. Neither frontend contains any protocol logic — they only call session methods and render snapshots.

## Adapters

dbg uses the [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/) — the same open standard VS Code uses. Any DAP-compliant adapter can be added by implementing the four-method `AdapterDefinition` interface in `src/engine/adapters/`.

| Adapter ID | Executable | Platform |
|---|---|---|
| `lldb-dap` | `lldb-dap` / `codelldb` | macOS, Linux, Windows |
| `debugpy` | `python3 -m debugpy.adapter` | macOS, Linux, Windows |

## Documentation

| Doc | Covers |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Engine, IPC, shared UI layer, and both frontends |
| [docs/KEYBINDINGS.md](docs/KEYBINDINGS.md) | Full keybinding reference for both frontends |
| [docs/USER_FLOWS.md](docs/USER_FLOWS.md) | Multi-file source-follow, fuzzy switcher, process attach |
| [docs/TESTING.md](docs/TESTING.md) | Headless smoke-test suite and verification approach |
| [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) | Current limitations and honest caveats |

## Generating the demo GIF

```bash
brew install vhs
npm run build:fixtures
vhs demo/demo.tape
```
