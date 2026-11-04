# Self-Check

## Claims
- `runDapCli` returns `{ kind: 'error', message: 'dap exited with code N' }` when the command exits nonzero and its stdout classifies as `stopped` or `ok`. dap's `Error:` and `Program terminated` text keeps its classification at any exit code.
- `defaultDapCliRunner(binPath, timeoutMs = 60_000)` always returns a numeric exit code: a numeric `err.code` is kept, and a spawn failure (`ENOENT`) or a timeout kill becomes 1. If stdout is empty, the error message is used as stdout.
- `runDapProbe` is unchanged. With the fix, an `eval` that exits 42 is recorded as "eval failed" and not as its printed value, which was the case in hammerhead-debug#2, and a `debug` that exits nonzero throws `dap debug failed`.

## Evidence
```json
[
  { "type": "file", "file": "orca/changes/dap-exit-status/.harness/red/red-2026-11-04.txt", "content": "RED before the change: 5 failed (nonzero-json, eval-nonzero, debug-nonzero, spawn-failure, timeout)" },
  { "type": "command", "command": "orca record-red dap-exit-status", "exit_code": 0, "output": "Verdict: RED_RECORDED (5 scenarios)" },
  { "type": "command", "command": "npx vitest run", "exit_code": 0, "output": "Tests 57 passed (57)" },
  { "type": "command", "command": "npx tsc --noEmit -p .", "exit_code": 0, "output": "TypeScript: No errors found" },
  { "type": "command", "command": "orca verify dap-exit-status", "exit_code": 0, "output": "Coverage: 100% (5/5) Verdict: PASS" }
]
```

## Known Limitations
- SC-3 is a preservation criterion: the `terminated-nonzero` regression test and the existing zero-exit tests pass before and after the change, so they have no RED and are not mapped scenarios.
- Nothing was tested against a live `dap` binary; the runners are scripted, plus real subprocesses for the missing-binary and timeout cases. The exit code of a real dap on `Error:` output was not checked.
- A real CLI test run needs `dist/` to be built first; on a fresh clone without a build, 8 CLI tests fail. This was already the case before the change.

## Unresolved Assumptions
- No caller relies on `exitCode` being a string. `DapCliRunner` was already typed `exitCode: number`.
