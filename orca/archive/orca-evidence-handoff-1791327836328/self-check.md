# Self-check

## Claims
- Confirmed actual guard instrumentation preceded code edits; five real assertion failures established RED, one actual CLI path passed.
- Budget exhaustion now forbids new cycles; observation text/hash is checked at verdict and fix; inconsistent confirmed verdicts cannot authorize a fix.
- Local migration rollback plan preserves installed package and launcher before replacement; restore their exact predecessor bytes on failed installed CLI checks. No registry release or user source changes.

## Evidence
```json
[
  {
    "type": "command",
    "command": "npm test -- --reporter=json --outputFile=orca/changes/orca-evidence-handoff/.harness/evidence/full-release.json",
    "exit_code": 0,
    "output": "51 pass / 0 fail. Regression tests reject tampered/empty observation and inconsistent confirmed result, exhausted and invalid budgets; actual CLI blocks premature fix/verdict and reruns real failed assertion then successful correction. Existing guard/session/CLI/install/DAP adapter tests passed. Raw reporter .harness/evidence/full-release.json."
  },
  {
    "type": "command",
    "command": "npm run build",
    "exit_code": 0,
    "output": "TypeScript compiler completed, exit 0."
  }
]
```

## Known Limitations
- Integrity is not independent authentication: callers can supply or rehash invented observations; CONFIRMED semantics remains operator-reviewed. No proof of hypothesis truth, sandbox or automatic debugger execution.
- Full tests include deterministic mocked DAP adapter tests, not a live debugger E2E. Local CLI handoff uses actual Node assertion output. Repro shell exit zero alone cannot establish Orca GREEN.
- Historical sessions with placeholder hashes or incomplete confirmed capture are intentionally rejected at verdict/fix and must recapture evidence.
- Local install and draft delivery remain pending. Phase enforcement is degraded where phase.json is absent.

The confirmed investigation fix receipt binds sha256(git diff HEAD -- src/debug-guard.ts); its original focused test repro completed with resolved=true after the fix. Patched Vitest 4.1.11 clean install audited zero vulnerabilities. Actual CLI regression additionally rejects a tampered stored observation before fix and a fifth hypothesis after four real REFUTED CLI cycles.
