# hammerhead-debug

> ⚠️ **BETA channel (`@beta` npm tag).** Published as part of a
> coordinated beta release across the LoomKit harness family (loomkit,
> seal-gate, hammerhead-debug, pilotfish) so `npm install
> @gotako/loomkit@beta` can pull in real dependency versions instead of
> requiring all four repos cloned side by side. **Expect crashes,
> missing pieces, and breaking changes without notice.** Not
> production-ready. Install the default (non-`@beta`) dist-tag for a
> stable version once one exists; only opt into `@beta` if you know
> what you're doing and are willing to hit rubbish.

Hypothesis-gated debugging. No fix is ever written until a hypothesis is
**CONFIRMED** by a real, captured observation — a real debugger stop, a
real log line, a real test result. Never a guess dressed up as
confidence.

Standalone package — no dependency on LoomKit or any other tool in this
family. Usable directly by an agent (as a Claude Code / Codex skill), by
a human at the CLI, or as a library.

## The Loop

```
symptom → [hypothesis → predict → probe → observe → verdict]* → fix
```

- **hypothesis**: a specific, falsifiable claim about the cause.
- **predict**: what you'd expect to observe if the hypothesis is right.
- **probe**: gather real evidence — either a real debugger operation
  (DAP: set a breakpoint, hit it, evaluate an expression in that live
  stack frame) or a captured log/instrumentation/test result. A probe
  can **only** gather evidence — it is structurally forbidden from
  modifying the code under repair.
- **verdict**: CONFIRMED (prediction held) or REFUTED (it didn't) — and
  a verdict without a real captured observation is rejected outright,
  not just discouraged.
- **fix**: only writable once a cycle is CONFIRMED. Exhausting
  `max_refuted_cycles` (default 4) without a confirmed hypothesis means
  stop guessing and escalate to a stronger model or a human — not "try
  one more thing."

## Install

```bash
npm install    # or pnpm install
npx tsc        # outputs dist/
```

### Make it a real skill (recommended)

```bash
node dist/cli.js install
# copies skill/SKILL.md to ~/.claude/skills/hammerhead-debug/ and
# ~/.codex/skills/hammerhead-debug/ — the workflow becomes something an
# agent picks up automatically, not something you paste every time.
#
# --agent claude-code|codex   install to just one
# --project                    install into ./.claude/skills/, ./.codex/skills/
#                               (cwd-relative) instead of your home directory
```

## CLI

```
hammerhead-debug install [--agent claude-code|codex] [--project]
hammerhead-debug open --symptom "<desc>" --repro "<cmd>" [--plan <p> --task <t>] [--dir <dir>]
hammerhead-debug hypothesis <session-id> "<hypothesis>" --predict "<prediction>" [--dir <dir>]
hammerhead-debug probe <session-id> --kind dap --break <path:line> --evaluate "<expr>" [--script <path>] [--dap-bin <path>] [--dir <dir>]
hammerhead-debug probe <session-id> --kind instrumentation|isolated_test|trace_read --observation "<captured evidence>" [--dir <dir>]
hammerhead-debug verdict <session-id> --result CONFIRMED|REFUTED [--reason "..."] [--dir <dir>]
hammerhead-debug fix <session-id> --diff-sha256 <hash> [--dir <dir>]
hammerhead-debug status <session-id> [--dir <dir>]
hammerhead-debug check <session-id> [--dir <dir>]
hammerhead-debug list [--dir <dir>]
```

`--dir` defaults to `.hammerhead-debug` (relative to cwd) and is where
session JSON files are written/read. Point it at a LoomKit changeDir
(`loomkit/changes/<name>` or `openspec/changes/<name>`) to tie a debug
session's evidence to the plan task it serves.

### Example

```bash
hammerhead-debug open --symptom "checkout total is wrong" --repro "node tests/checkout.test.js"
# → {"session_id": "dbg-a1b2c3d4"}

hammerhead-debug hypothesis dbg-a1b2c3d4 "discount applied twice" --predict "total should be 100, not 90"

# Real debugger evidence:
hammerhead-debug probe dbg-a1b2c3d4 --kind dap --script checkout.js --break checkout.js:42 --evaluate "discount"
# or, log evidence:
hammerhead-debug probe dbg-a1b2c3d4 --kind instrumentation --observation "log line 42: discount applied twice, total=90"

hammerhead-debug verdict dbg-a1b2c3d4 --result CONFIRMED --reason "evidence matches the prediction exactly"

# Now, and only now, edit the actual code — then:
hammerhead-debug fix dbg-a1b2c3d4 --diff-sha256 "$(git diff | shasum -a 256 | cut -d' ' -f1)"

hammerhead-debug check dbg-a1b2c3d4   # re-runs --repro, confirms the symptom is actually gone
```

## DAP probing

The `dap` probe kind drives a **real debugger** via
[`debug-skill`](https://github.com/AlmogBaku/debug-skill)'s `dap` CLI —
a daemon-backed wrapper around the Debug Adapter Protocol, auto-detecting
the backend from the file extension:

| Extension | Backend |
|---|---|
| `.py` | debugpy (Python) |
| `.go` | dlv (Go) |
| `.js` / `.ts` | js-debug (Node.js/TypeScript) |
| `.rs` / `.c` / `.cpp` | lldb-dap (Rust/C/C++) |

Requires building `debug-skill`'s `dap` binary separately (`go build -o
dap ./cmd/dap` in that repo — needs Go), plus whichever debugger backend
your target language needs (e.g. `pip install debugpy` for Python). Pass
`--dap-bin <path>` if `dap` isn't on `PATH`.

If DAP setup is a blocker, `instrumentation`/`isolated_test`/
`trace_read` probes need no external tooling at all — capture real
evidence yourself (a log line, a standalone test, an existing trace) and
record it with `--observation`.

## As a library

```ts
import {
  createDebugLoopJson, readDebugLoopJson, writeDebugLoopJson,
  DebugGuard, checkSymptomResolved,
  runDapProbe,
  installSkill, defaultSkillSourcePath,
  sha256File, sha256String,
} from '@gotako/hammerhead-debug'
```

`DebugGuard` exposes the mechanical checks the CLI enforces
(`canOpenCycle`, `probeIsLegal`, `verdictIsHonest`, `canWriteFix`,
`escalateIfNeeded`) if you're building your own tool on top rather than
using the CLI directly.

## Relationship to LoomKit

Originally built inside LoomKit's `src/harness/`, extracted to its own
package (matching how `seal-gate` already stood apart) once it became a
general-purpose debugging tool, not something specific to LoomKit's own
lifecycle. LoomKit depends on this package (`file:../hammerhead-debug`)
only to *read* a debug session's verdict when a plan task's completion
references one (`loomkit plan-json complete --debug-session ...
--debug-cycle ...`) — this package has zero dependency in the other
direction and works standalone. See `~/work/loomkit/HARNESS.md` for the
full pipeline (LoomKit + seal-gate + hammerhead-debug + pilotfish
together).

## Test

```bash
npx vitest run
```

## License

ISC
