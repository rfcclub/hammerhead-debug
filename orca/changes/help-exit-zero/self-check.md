# Self-Check

## Claims
- `help`, `--help` and `-h` print the usage and exit 0 (no arguments already did); an unknown command still exits 1.

## Evidence
```json
[
  { "type": "file", "file": "orca/changes/help-exit-zero/.harness/red/red-2026-11-04.txt", "content": "RED before the change: the help flags exited nonzero" },
  { "type": "command", "command": "orca record-red help-exit-zero", "exit_code": 0, "output": "Verdict: RED_RECORDED" },
  { "type": "command", "command": "full test suite", "exit_code": 0, "output": "vitest run 58/58, tsc clean" },
  { "type": "command", "command": "orca verify help-exit-zero", "exit_code": 0, "output": "Coverage: 100% (1/1) Verdict: PASS" }
]
```

## Known Limitations
- Only the exit code of an explicit help request changes; the usage text and other commands are unchanged.
