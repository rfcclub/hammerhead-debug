# Tasks

- [x] H1: Add failing tests/evidence-integrity.test.ts for budget/integrity/confirmation consistency and actual CLI handoff; make existing successful guard fixtures use real captured hashes.
- [x] H2: After the captured CONFIRMED hypothesis and RED, implement bounded/hash checks in src/debug-guard.ts; migrate README, skill/SKILL.md and src/types.ts comment to Orca, clarifying supplied observation and semantic-verdict trust.
- [ ] H3: Run full tests/build, gate-plan/code/executable verify and archive; prove packaged and registered CLI, preserve predecessor/rollback and create a draft PR.

## Locked criteria mapping
- SC-1: H1/H2 stop exhausted and invalid budgets while retaining under-budget opening.
- SC-2: H1/H2 recompute hashes at verdict/fix and reject contradictory verdict state.
- SC-3: H1 actual CLI records failed assertion output, requires captured confirmation, and independently reruns the repro before/after correction.
- SC-4: H3 preserves raw command evidence and real local package integration, with no automatic approval/debugger execution.
