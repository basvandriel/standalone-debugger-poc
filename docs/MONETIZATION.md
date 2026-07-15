# Monetization strategy

Working notes from a strategy discussion on whether/how `dbg` could become a business, not just an open-source tool. Nothing here is committed to — it's a record of the reasoning so far.

## Starting position: skepticism

The two explicit inspirations for `dbg` — lazygit and k9s — are not businesses. They're beloved free OSS projects sustained by maintainer passion and modest GitHub Sponsors income, not anyone's living. That's not incidental:

- The target audience (Helix/Neovim/tmux users who explicitly reject bloat and lock-in) skews hardest against paying for dev tooling of any kind.
- The natural free alternative isn't some obscure competitor — it's VS Code's own debug UI, which is excellent and already free.
- A local, single-player debugging session has no obvious recurring-value hook the way a team-collaboration or cloud-sync product does.
- Replay.io raised $30M+ chasing time-travel/recorded debugging as a product and struggled — evidence that "make money from debugging tools" is hard even with more ambitious tech and funding than a lazygit-style tool would have.

The likely default outcome of building `dbg` well is "becomes well-known and loved, like lazygit" — a great outcome, just not a SaaS one.

## The reframe: the free client is distribution, not the product

Given all of the above, direct monetization of the terminal client itself is the wrong target. The applicable playbook instead is the one ngrok, Tailscale, Sentry, and Supabase ran: give away a genuinely great local tool, monetize the infrastructure problem that only shows up once people use it seriously.

## The core insight: DAP has a network seam

A debug session has three parties — the frontend (`dbg`), the adapter (e.g. `lldb-dap`), and the target process. Today all three run on one machine. But debugging is increasingly needed *where the frontend can't easily be*: a CI runner, a Kubernetes pod, a remote VM behind a VPN. "Just SSH in and run gdb" only half-solves this.

A hosted **remote debug relay** — `dbg attach <session-id>` pulling up a live DAP session running anywhere, tunneled through hosted infrastructure — is a genuine technical moat (NAT traversal, auth, session brokering) that's annoying enough to self-host that people would pay for it. Same shape as ngrok's business, for DAP instead of HTTP.

## Two go-to-market wedges on top of the relay

Both ride the same infrastructure — this is one product with two entry points, not two products.

### 1. "Debug the CI failure" (bottom-up, fast to prove out)

Failed tests in CI are debugged today by staring at logs and guessing. A GitHub Actions / GitLab CI integration that, on failure, keeps the container alive and gives you one command to drop straight into `dbg` at the failure state is an immediate, visceral "I need this" demo.

Funnel: individual dev installs free `dbg` client -> team adopts CI-debug integration -> billing the org. Precedent: the wedge Depot and BuildPulse used for CI-adjacent pain.

### 2. "Attach from the alert" (top-down, bigger contracts)

Datadog / Honeycomb / Sentry tell you *that* something broke in production; none let you reach in and inspect live state. A button on a trace that spins up a `dbg` session attached to the actual failing pod, live, sits in the same budget line as observability tooling. MTTR reduction is a number enterprises pay real money to move.

Higher effort, longer sales cycle, but much higher ACV than the CI wedge — a genuine expansion of what observability platforms currently offer, not a niche developer convenience.

## Near-free bonus features once the relay exists

- **Pair debugging** — a second person attaches to the same session (read-only or co-driving), like Live Share but for a debugger. Cheap once sessions are already tunneled through hosted infra.
- **Session breadcrumbs** — the engine already emits a DAP event log (`DapLogEntry` stream); persisting "breakpoint hit here, inspected these values, stepped through this path" as a shareable artifact (attach to a PR or incident postmortem) is a much smaller lift than true time-travel replay, and gives people something concrete to link to.

## Business model shape

- Free client, forever — non-negotiable for adoption in this audience.
- Usage-based or seat-based cloud tier for the relay / CI integration / collaboration features.
- Standard PLG-to-enterprise motion: individual adoption drives team adoption drives the sale.

## Honest caveat

Pursuing either wedge turns `dbg` from a weekend tool into an actual infrastructure company: uptime commitments, and — especially for the observability/production wedge — security review and eventually SOC2, since it means tunneling into people's live systems. That's a real fork in the road, not a feature branch.

If that scope isn't wanted, the smaller, scoped alternative is: keep `dbg` itself fully free and unaffiliated with any company, and treat only the CI-debug wedge as a separate, much smaller side product later — decoupled from whether `dbg` the client "succeeds" as OSS.

## Open questions (not yet decided)

- Is building an infrastructure company actually the goal here, or is a free, well-loved OSS tool the actual desired outcome?
- If pursuing a wedge: CI-debug first (faster to validate, smaller checks) or observability-attach first (slower, bigger checks)?
- Relay infrastructure is a prerequisite for both wedges and hasn't been scoped at all yet (NAT traversal approach, session auth model, hosting cost profile).
