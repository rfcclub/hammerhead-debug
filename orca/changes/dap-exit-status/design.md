# Design

`DapCliRunner` keeps its shape `{ stdout, exitCode }`; `exitCode` is now always a number. `defaultDapCliRunner(binPath, timeoutMs = 60_000)` maps a numeric `err.code` to itself and every other failure (spawn error string such as `ENOENT`, a kill on timeout with `code` null) to 1, and appends the error to stdout only when stdout is empty, so the message is not lost.

`runDapCli` classifies stdout as before. When `exitCode !== 0`, a `stopped` or `ok` classification becomes `{ kind: 'error', message: 'dap exited with code N', raw }`; `error` and `terminated` are kept, because dap prints those texts for its own failures and for a finished program.

`runDapProbe` needs no change: a debug error already throws, and a non-`ok` eval already records "eval failed". Tests use scripted runners for exit codes and a real `defaultDapCliRunner` against a missing binary and a sleeping script for spawn and timeout.
