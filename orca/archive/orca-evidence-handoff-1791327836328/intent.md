# Intent: Hammerhead Orca evidence handoff

## Raw Request
Thoor: finish Orca, then Seal, Pilotfish, Hammerhead; use Orca, LoomKit obsolete; continue with full permission.

## Problem
The CLI reports exhausted refutation budgets but can still open a fifth hypothesis; verdict guards accept any nonempty observation hash. Current instructions still describe LoomKit. Both guard gaps are reproduced with actual built API instrumentation before edits.

## Scope
Guard evidence integrity and budget enforcement, current Orca/manual handoff instructions, real CLI tests and package deployment with rollback/draft PR. Preserve standalone no-dependency operation.

## Non-Goals
Automatically proving semantic hypotheses, authenticating caller-provided logs, sandboxing debugger evaluation or repro shell commands, automatic Hammerhead execution/approval, redesigning Orca debug_ref validation.

## Success Criteria
- SC-1: Exhausted or invalid refutation budgets cannot open a new hypothesis; under-budget valid prediction works.
- SC-2: Verdict and fix authorization reject missing, empty or mismatched captured evidence and inconsistent confirmed verdicts; intact observation hashes work.
- SC-3: Real CLI can record actual failed-test observation, confirm a matching prediction, authorize a fix, and rerun the repro to observe failure then success; it blocks fix before confirmation and verdict before observation.
- SC-4: Build/full tests, executable verify/gates/archive, isolated package and registered installed CLI evidence, byte-matched rollback and draft PR complete local delivery without GitHub or LoomKit runtime dependency.

## Intent Approval
Status: APPROVED
Approved by: Thoor, approved campaign continuation/full permission
Date: 2026-10-06
