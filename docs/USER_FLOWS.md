# Multi-file projects and process interception

Both proposals originally written up here are now **implemented**. This doc
keeps the original design rationale (why these flows look the way they do)
and adds exactly what shipped and how to try it. Kept separate from
[KNOWN_ISSUES.md](KNOWN_ISSUES.md) since the limitations these features have
are deliberate design tradeoffs, not bugs.

## Background: why this was a gap

`SessionSnapshot.sourcePath` used to be a single fixed string, set once from
the CLI's `--source` flag and never changed for the life of the session —
the source panel never followed where execution actually was, and there was
no file switcher in either frontend. This was a UI-layer gap, not an engine
one: `StackFrameDescriptor.sourcePath` already carried a per-frame file path
from every DAP `stackTrace` response, and `SessionSnapshot.breakpoints` was
already file-scoped (`Record<string, BreakpointDescriptor[]>`). Both
proposals below turned out to be almost entirely UI-layer work plus, for
attach, a new CLI subcommand and DAP `attach` support that didn't exist yet.

## Proposal 1: multi-file project flow — implemented

**Core idea: follow, don't ask.** No project concept, file tree, or config
step — DAP already reports exactly which file+line you're in on every stop.

- **The source panel follows execution automatically.** `useUiStore`'s
  `activeSourcePath` (not `snapshot.sourcePath`, which stays just the CLI's
  initial hint) updates whenever a stop lands on a different file than
  what's on screen. `--source` is still accepted as the initial file to
  show, but `dbg attach` can omit it entirely — the panel just shows nothing
  until the first stop supplies a file.
- **A fuzzy file switcher**: `Ctrl+P`/`Cmd+P` in the Electron app, `f` in the
  TUI (the original proposal's `gf`/`:e <fuzzy>` became a dedicated overlay
  component instead, mirroring how `CommandBar` is already duplicated per
  frontend). The candidate list (`knownSourceFiles`) is every file execution
  has visited or that has a breakpoint, plus a one-time bounded directory
  scan near the initial `--source` at startup (`src/engine/workspace/listSourceFiles.ts`)
  — not a project-wide index, so there's zero config needed to jump ahead
  and set a breakpoint in a file execution hasn't reached yet.
- **Breadcrumb**: reused the existing source panel title rather than adding
  new status-bar chrome, per the original proposal's "existing real estate"
  preference.

Deliberately still excluded: a file tree panel, a `.dbgignore`, any
workspace/project config file.

**How to try it** (Rust, new `fixtures/multi-file-demo`: `main.rs` calling
into sibling modules `ops.rs` and `report.rs`):

```bash
# from the repo (after npm run build:fixtures)
npm run tui:fixture:multi     # or: npm run dev:fixture:multi for Electron

# or with the published CLI
dbg run --adapter lldb-dap \
  --program fixtures/multi-file-demo/target/debug/multi-file-demo \
  --source fixtures/multi-file-demo/src/main.rs
```

Press `f`, type `report`, `Enter` — jumps to `report.rs`, never visited yet.
Set a breakpoint (`b`), switch back to `main.rs` (`f`, type `main`, `Enter`),
then `c` to run — the panel follows back to `report.rs` the instant it stops
there.

## Proposal 2: `dbg attach --name`/`--pid` — implemented

**Headline flow — attach-by-name**, built on `lldb-dap`'s `attach` request
with `waitFor: true` (field names and polling behavior confirmed empirically
via `strings` on the installed binary, since this isn't otherwise
documented):

```bash
dbg attach --adapter lldb-dap --name <path-to-binary>
```

dbg opens immediately in a new `waiting` phase ("watching for..." badge,
reusing the existing `Spinner` component), then the program is started
however it normally would be — VS Code's Run button, `cargo run`, a
double-click — with zero coordination between the two tools. `lldb-dap`
polls for a matching process and attaches the instant one appears; dbg's
window lights up already attached, breakpoints/stepping/continue all work
exactly as they do after `run`.

- **Trivial variant** for when a PID is already known: `dbg attach --pid 51234`.
- `--name` is resolved to an absolute path the same way `run`'s `--program`
  is, since that's the only `lldb-dap` matching behavior this project has
  verified (see [KNOWN_ISSUES.md](KNOWN_ISSUES.md)).
- **By-name attach waits with no timeout, by design** — `waitFor` is
  open-ended (bounded by the user going to start their program, not by dbg),
  so `DebugSession.start()` skips its usual 20-second handshake guard for
  this path only. `--pid` and `run` keep the guard.
- **Honest caveats**, documented in [KNOWN_ISSUES.md](KNOWN_ISSUES.md) rather
  than hidden: very early breakpoints can still race the attach (OS/DAP-level
  limitation, not fixable from the UI), and `lldb-dap`'s `waitFor` needs a
  brief moment to arm after the `attach` request — a non-issue for an actual
  human reacting to the status bar, but relevant if scripting the flow
  tightly.

**Bigger stretch, still not implemented:** VS Code launch configs support
`"debugServer": <port>` to point at an *external* DAP server instead of
spawning an adapter directly. dbg could run `dbg serve --port N` as a local
proxy — VS Code's F5 talks to dbg, dbg forwards to a real `lldb-dap` child
underneath, and dbg's own TUI/Electron window mirrors the session live. This
is the truest form of "interception" but means running `DapClient` as a
server instead of a client — a materially bigger change than attach-by-name,
worth revisiting once attach-by-name has proven the UX is wanted at all.

**How to try it** (new `fixtures/attach-demo`: a slow, human-watchable
counter loop):

```bash
# from the repo (after npm run build:fixtures)
npm run tui:fixture:attach

# or with the published CLI
dbg attach --adapter lldb-dap \
  --name fixtures/attach-demo/target/debug/attach-demo
```

Then, from a **second terminal**, start the built binary directly:

```bash
./fixtures/attach-demo/target/debug/attach-demo
```

dbg's `WATCHING` badge flips to `READY` the moment it catches the process —
no coordination needed beyond arming the first terminal first.

## What's left

Only the `dbg serve` DAP-proxy stretch from Proposal 2 remains unimplemented
— everything else described above is real, tested code (see
[TESTING.md](TESTING.md) for the six smoke scripts covering both flows).
