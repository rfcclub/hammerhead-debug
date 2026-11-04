# dap-exit-status Specification

## ADDED Requirements

### Requirement: Nonzero exit is an error

`runDapCli` MUST NOT classify output as `stopped` or `ok` when the command exited nonzero.

#### Scenario: nonzero-json

- **WHEN** a dap command prints valid JSON and exits 42
- **THEN** `runDapCli` returns kind `error` and the message names exit code 42.

#### Scenario: eval-nonzero

- **WHEN** `debug` stops normally and `eval` prints a value but exits 42
- **THEN** `runDapProbe` records the eval as failed and its captured text does not contain the value.

#### Scenario: debug-nonzero

- **WHEN** `debug` prints stopped JSON but exits 42
- **THEN** `runDapProbe` throws `dap debug failed`.

### Requirement: Runner failures are errors

The default runner MUST return a numeric nonzero exit code when the binary cannot be spawned or times out.

#### Scenario: spawn-failure

- **WHEN** the dap binary does not exist
- **THEN** `runDapCli` returns kind `error`.

#### Scenario: timeout

- **WHEN** the dap command runs longer than the runner's timeout
- **THEN** `runDapCli` returns kind `error`.
