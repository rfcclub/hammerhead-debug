# Intent: --help exits 0

## Raw Request
Thoor: "fix all di" (2026-11-04); Coda's review in rfcclub/hammerhead-debug#2 noted that `--help` prints usage but exits 1.

## Problem
`hammerhead-debug --help` (and `help`, `-h`) falls to the unknown-command branch: usage goes to stdout and the exit code is 1, so a script that checks the installed CLI with `--help` sees a failure.

## Scope
`help`, `--help` and `-h` print the usage and exit 0. An unknown command keeps exit 1.

## Non-Goals
Changing the usage text or other commands.

## Success Criteria
- SC-1: `hammerhead-debug help`, `--help` and `-h` print the usage and exit 0; an unknown command still exits 1.

## Intent Approval
Status: APPROVED
Approved by: Thoor, "fix all di" (Telegram, 2026-11-04), read by Aria as approval of the review fixes
Date: 2026-11-04
