# Proposed user flows: multi-file projects and process interception

Working notes from a design discussion. **Nothing here is implemented** — the
codebase today only supports the single-file, `dbg run`-launches-the-program
flow the fixtures exercise. This is a record of two proposals for where the
UX goes next, kept separate from [KNOWN_ISSUES.md](KNOWN_ISSUES.md) because
these are deliberate scope gaps, not bugs.

## Current state, precisely

`SessionSnapshot.sourcePath` (`src/shared/types.ts`) is a single fixed string,
set once from the CLI's `--source` flag and never changed for the life of the
session. The renderer only reloads the source panel when *that* path changes
(`src/renderer/src/App.tsx`, the `loadedSourcePath` effect) — it never follows
where execution actually is. There is no file switcher in either frontend.

This is easy to miss as a gap because the engine is already more multi-file-
ready than the UI exposes:

- `StackFrameDescriptor.sourcePath` (`src/shared/types.ts`) already carries a
  **per-frame** file path, populated straight from the DAP `stackTrace`
  response.
- `SessionSnapshot.breakpoints` is already `Record<string, BreakpointDescriptor[]>`
  and `DebugSession.toggleBreakpoint(file, line)` already takes a file
  argument — breakpoints are already file-scoped end to end.

So both proposals below are UI-layer changes on top of engine capabilities
that already exist, not new engine work.

## Proposal 1: multi-file project flow

**Core idea: follow, don't ask.** DAP already reports exactly which file+line
you're in on every stop. There's no need for a "project" concept, a file
tree, or a config step.

1. **Source panel auto-follows the selected stack frame** instead of a fixed
   CLI arg. Step into a function in another file and the panel swaps to it,
   cursor on the right line, automatically. `--source` becomes optional — at
   most a hint for what's shown before the first `stopped` event; if omitted,
   show the same "no data yet" placeholder `phaseMessages.ts` already uses
   elsewhere rather than requiring a file up front.
2. **A fuzzy file switcher**, one keystroke — `gf` in the TUI's k9s-style
   scheme, or `:e <fuzzy>` reusing the existing command bar. The candidate
   list needs no filesystem indexing or project-root detection: it's just
   "every file that's shown up so far" (visited frames + files with
   breakpoints), which grows for free as you debug. Jumping *ahead* of
   execution to set a breakpoint in an unvisited file is the only case that
   needs anything extra — a typed path resolved relative to `cwd` covers it.
3. **A breadcrumb in the status bar** (`relative/path.rs:42`) so it's always
   obvious which of N files is on screen, since that's no longer implied by
   "the one file you passed on the CLI."

Deliberately excluded from this proposal: a file tree panel, a `.dbgignore`,
or any workspace/project config file. The whole point is that none of that
is needed for the common case.

## Proposal 2: intercepting a process started elsewhere (e.g. from VS Code)

**Headline flow — attach-by-name**, built on a DAP feature `lldb-dap` already
implements (`attach` request with `waitFor: true`):

```
dbg attach --adapter lldb-dap --name loop-demo
```

dbg opens immediately in a new `waiting` phase ("watching for `loop-demo`…",
reusing the existing `Spinner` component), then the program is started
however it normally would be — VS Code's Run button, `cargo run`, a
double-click — with zero coordination between the two tools. `lldb-dap` polls
the OS process list and attaches the instant a matching process appears;
dbg's window lights up already attached.

Implementation shape: a `startAttach()` sibling of `DebugSession`'s existing
`runHandshake()`, and a `buildAttachArgs()` sibling of
`AdapterDefinition.buildLaunchArgs()` (`src/engine/adapters/types.ts`) — small
and additive, no transport-layer changes.

- **Trivial variant** for when a PID is already known:
  `dbg attach --pid 51234`.
- **Honest caveat**, to land in `KNOWN_ISSUES.md` once this ships rather than
  being hidden: attach happens *after* the process already exists, so
  breakpoints on the very first lines of `main()` can race the attach. That's
  an OS/DAP-level limitation, not something the UI can paper over.

**Bigger stretch, explicitly not phase 1:** VS Code launch configs support
`"debugServer": <port>` to point at an *external* DAP server instead of
spawning an adapter directly. dbg could run `dbg serve --port N` as a local
proxy — VS Code's F5 talks to dbg, dbg forwards to a real `lldb-dap` child
underneath, and dbg's own TUI/Electron window mirrors the session live. This
is the truest form of "interception" (press F5 in VS Code, dbg just appears)
but means running `DapClient` as a server instead of a client, which is a
materially bigger change than attach-by-name. Worth treating as a distinct
follow-up once attach-by-name has proven the UX is wanted at all.

## Suggested build order

1. Source-panel-follows-selected-frame (Proposal 1, item 1) — smallest change,
   biggest payoff, and a prerequisite for the fuzzy switcher to feel coherent.
2. Fuzzy file switcher (Proposal 1, item 2).
3. `dbg attach --name` / `--pid` (Proposal 2, headline flow).
4. `dbg serve` DAP proxy (Proposal 2, stretch) — only after 1–3 validate that
   people actually want dbg reaching into externally-started processes.
