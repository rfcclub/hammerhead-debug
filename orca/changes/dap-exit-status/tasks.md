# Tasks

- [x] D1 (SC-1, SC-2, SC-3): Add failing tests in tests/dap-cli.test.ts and tests/dap-probe.test.ts for nonzero JSON, eval/debug nonzero, spawn failure, timeout and terminated-nonzero.
- [x] D2 (SC-1, SC-2, SC-3): In src/dap-cli.ts, normalise the default runner's exit code, add its timeout parameter, and turn nonzero `stopped`/`ok` results into errors.
- [x] D3 (SC-1, SC-2, SC-3): Full tests, build, verify and gates; self-check.

## Locked criteria mapping
- SC-1: D1/D2 nonzero-json, eval-nonzero, debug-nonzero.
- SC-2: D1/D2 spawn-failure, timeout.
- SC-3: D1/D2 an unmapped regression test (terminated-nonzero) and the existing zero-exit tests, which pass before and after the change; a preservation criterion has no RED.
