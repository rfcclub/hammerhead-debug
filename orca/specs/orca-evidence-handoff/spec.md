# orca-evidence-handoff Specification

## Requirements

### Requirement: Bounded hypothesis budget

Hammerhead MUST block new cycles when the refutation budget is exhausted or invalid.

#### Scenario: exhausted-budget

- **WHEN** four hypotheses have been refuted under a budget of four
- **THEN** the next hypothesis is rejected and escalation remains true.

#### Scenario: invalid-budget

- **WHEN** the session budget is zero, negative, noninteger or nonfinite
- **THEN** opening another cycle is rejected.

### Requirement: Observation integrity

Hammerhead MUST verify captured observation hashes again at verdict and fix authorization.

#### Scenario: tampered-observation

- **WHEN** captured text is changed without updating its recorded hash
- **THEN** both verdict and authorized fix are rejected.

#### Scenario: empty-observation

- **WHEN** captured observation is empty or whitespace
- **THEN** verdict is rejected even if a matching hash is present.

#### Scenario: inconsistent-verdict

- **WHEN** a confirmed status and held prediction contain a REFUTED verdict result
- **THEN** fix authorization is rejected.

### Requirement: Standalone manual handoff

Hammerhead MUST remain standalone and require confirmation before fix while recording actual repro output.

#### Scenario: actual-cli-handoff

- **WHEN** the real CLI receives an actual failed assertion, records its observation and confirms a matching prediction
- **THEN** it blocks premature fix/verdict, authorizes the confirmed fix, and reports repro failure before correction and success afterward.
