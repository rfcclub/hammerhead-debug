# Intent: DAP exit status is evidence

## Raw Request
Thoor: "fix all di" (2026-11-04), after Coda's publish-readiness review in rfcclub/hammerhead-debug#2.

## Problem
`runDapCli` ignores the runner's exit code and classifies stdout alone. Coda reproduced it with the installed package: `debug` returned stopped JSON with exit 0, then `eval` printed `{"eval_result":{"value":"5","type":"int"}}` and exited 42, and `runDapProbe` hashed `... x = 5` as a successful observation. `defaultDapCliRunner` also reports a spawn failure (`ENOENT`) as the string exit code `'ENOENT'` with empty stdout, which classifies as `ok`.

## Scope
`src/dap-cli.ts`: a nonzero exit, a spawn error or a timeout is an error result, unless dap printed its own `Error:` or `Program terminated` text, which keeps its current classification. `defaultDapCliRunner` always returns a numeric exit code and accepts a timeout.

## Non-Goals
Changing `runDapProbe`'s observation format, live DAP testing, a new dependency, publishing.

## Success Criteria
- SC-1: A `dap` command that exits nonzero is never classified as `stopped` or `ok`, whatever its stdout; `runDapProbe` does not record an eval value from it, and a nonzero `debug` throws.
- SC-2: A spawn failure or a timeout of the default runner yields a numeric nonzero exit code and an error result.
- SC-3: `Error:` and `Program terminated` output keep their current classification at any exit code; zero-exit behaviour is unchanged.

## Intent Approval
Status: APPROVED
Approved by: Thoor, "fix all di" (Telegram, 2026-11-04), read by Aria as approval of the four review fixes
Date: 2026-11-04
