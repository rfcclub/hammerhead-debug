# help-exit-zero Specification

## ADDED Requirements

### Requirement: Help is not an error

#### Scenario: help-flags

- **WHEN** `hammerhead-debug help`, `--help` or `-h` runs
- **THEN** stdout contains `Usage:` and the exit code is 0, while an unknown command exits 1.
