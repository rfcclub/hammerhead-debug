---
name: hammerhead-debug
description: >-
  Hypothesis-gated debugging with real debugger evidence (DAP: breakpoints,
  stepping, expression evaluation) or instrumentation/log evidence. No fix is
  ever written without a CONFIRMED hypothesis backed by a captured
  observation. Use when the user reports a bug, unexpected behavior, or asks
  to debug an issue.
---

# Debug Mode (hammerhead-debug)

You are now in **DEBUG MODE**. You must debug with **evidence**, not
guesswork — and you may not write a fix until a hypothesis has been
CONFIRMED by a real, captured observation.

**Why this discipline:** guessing at fixes from reading code alone produces
plausible-sounding changes that don't address the real cause. Every fix in
this mode traces back to one specific, falsifiable hypothesis that was
tested against real evidence and held.

## The loop

1. **Open a session** — one symptom, one reproduction command:
   ```bash
   hammerhead-debug open --symptom "<what's wrong>" --repro "<command that reproduces it>"
   ```
   Prints `{ "session_id": "dbg-XXXXXXXX" }`. Use that id in every command
   below.

2. **State a falsifiable hypothesis** — a prediction that could be wrong:
   ```bash
   hammerhead-debug hypothesis <session-id> "<why you think the bug happens>" --predict "<what you expect to observe if you're right>"
   ```
   Only one hypothesis may be open at a time — resolve it (confirm or
   refute) before opening another. This is enforced, not a suggestion.

3. **Probe for real evidence** — two shapes:
   - **DAP** (preferred when you can reach the running/runnable program):
     real breakpoint, real stopped process, real expression evaluation.
     ```bash
     hammerhead-debug probe <session-id> --kind dap --script <path> --break <file:line> --evaluate "<expression>"
     ```
   - **Instrumentation / isolated test / trace read** (when DAP isn't
     available or isn't the right tool — e.g. a distributed system, a
     browser test, reading an existing log): capture the evidence yourself
     (add a log line, write an isolated test, read a trace), then record
     it:
     ```bash
     hammerhead-debug probe <session-id> --kind instrumentation --observation "<exact captured evidence — quote it, don't paraphrase>"
     ```
   Either way, the probe **only gathers evidence — it must never modify
   the code you're debugging.** That's enforced by the guard, not left to
   discipline.

4. **Render an honest verdict**:
   ```bash
   hammerhead-debug verdict <session-id> --result CONFIRMED --reason "<why the observation matches the prediction>"
   # or
   hammerhead-debug verdict <session-id> --result REFUTED --reason "<why it didn't>"
   ```
   A verdict without a captured observation from step 3 is rejected — you
   cannot narrate your way to CONFIRMED.

5. **If REFUTED**: go back to step 2 with a *different* hypothesis — don't
   just re-word the same one. After 4 refuted cycles the session
   auto-flags for escalation (`hammerhead-debug status <session-id>` shows
   `escalation.escalate: true`) — stop guessing and hand off to a stronger
   model or the user rather than continuing to iterate blindly.

6. **If CONFIRMED**: now, and only now, write the actual fix in your normal
   editing tools. Then record it:
   ```bash
   hammerhead-debug fix <session-id> --diff-sha256 "$(git diff | shasum -a 256 | cut -d' ' -f1)"
   ```
   This is rejected if no cycle in the session is CONFIRMED, or if the fix
   isn't tied to the cycle that was confirmed.

7. **Verify the symptom is actually gone**:
   ```bash
   hammerhead-debug check <session-id>
   ```
   Re-runs the original `--repro` command from step 1. Report the result to
   the user — don't just assume the fix worked because the hypothesis was
   confirmed.

## Choosing DAP vs instrumentation

- **DAP** when: the bug is in a process you can launch or attach to
  locally, and you need to see live state (variable values, call stack) at
  a specific point. `hammerhead-debug probe --kind dap` drives a real
  debugger (via [debug-skill](https://github.com/AlmogBaku/debug-skill)'s
  `dap` CLI — auto-detects Python/Go/Node/Rust/C/C++ from the file
  extension) — set a breakpoint, it blocks until hit, evaluate an
  expression in that exact stack frame.
- **Instrumentation** when: DAP isn't reachable (remote/production,
  browser, distributed trace) or the bug is timing/concurrency-sensitive
  in a way a paused breakpoint would change. Add a log line, reproduce,
  read the real log output, quote it verbatim as `--observation`.

Both probe kinds are gated identically — same hypothesis discipline, same
"no fix before CONFIRMED" rule. Pick whichever gets you real evidence
fastest for this specific bug.

## Critical constraints

- NEVER call `hammerhead-debug fix` without a CONFIRMED cycle backing it —
  the guard rejects this, but don't try to work around it.
- NEVER paraphrase or summarize a `--observation` — quote the actual
  captured text (log line, evaluated value). A paraphrase isn't evidence,
  it's a claim about evidence.
- If you catch yourself wanting to skip straight to editing code because
  you're "pretty sure" what's wrong — that certainty is exactly the signal
  to open a hypothesis and probe it instead. Being right without evidence
  and being right with evidence look the same from outside; only one of
  them is debugging.
- `hammerhead-debug status <session-id>` at any point shows the full
  session state (all cycles, verdicts, fix status, escalation check) if
  you lose track of where you are.

## Session storage

Sessions live under `.hammerhead-debug/` in the current working directory
by default (override with `--dir <path>` on any command). Not tied to any
particular project's task-tracking system — this works standalone, in any
repo, for any bug, invoked directly by you.
