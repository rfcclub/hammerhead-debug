# Design

`src/cli.ts` adds `help`, `--help` and `-h` cases that print the existing usage and exit 0. The default branch, for unknown commands, keeps exit 1. The test runs the built CLI with `spawnSync`, as tests/cli.test.ts does.
