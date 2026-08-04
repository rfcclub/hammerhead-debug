import { describe, it, expect } from 'vitest'
import { DebugGuard, checkSymptomResolved } from '../src/debug-guard.ts'
import type { DebugCycle, DebugLoopJson, DebugProbe } from '../src/types.ts'

const makeSession = (cycles: DebugCycle[] = []): DebugLoopJson => ({
  schema_version: '1.0',
  session_id: 'debug/PCC-4821',
  bound_repo_sha: 'sha',
  serves_task: { plan: 'checkout-promo', task: 'TASK-3' },
  symptom: { description: 'x', repro_cmd: 'true', repro_sha256: null },
  cycles,
  fix: { authorized_by_cycle: null, applied: false, diff_sha256: null },
  escalation: { max_refuted_cycles: 4, on_exhaust: 'STOP and escalate' },
})

describe('DebugGuard.canOpenCycle', () => {
  it('blocks a hypothesis with no prediction', () => {
    const guard = new DebugGuard()
    expect(() => guard.canOpenCycle(makeSession(), { prediction: '' })).toThrow(/not falsifiable/)
  })

  it('blocks opening a new cycle while one is open', () => {
    const guard = new DebugGuard()
    const session = makeSession([{ id: 'H1', status: 'open', hypothesis: 'h', prediction: 'p' }])
    expect(() => guard.canOpenCycle(session, { prediction: 'p2' })).toThrow(/resolve the open cycle/)
  })

  it('allows opening a cycle when none is open and prediction is present', () => {
    const guard = new DebugGuard()
    expect(() => guard.canOpenCycle(makeSession(), { prediction: 'p' })).not.toThrow()
  })
})

describe('DebugGuard.probeIsLegal', () => {
  it('blocks an illegal probe kind', () => {
    const guard = new DebugGuard()
    expect(() => guard.probeIsLegal({ action: 'edit source', kind: 'patch' as DebugProbe['kind'] })).toThrow(/must collect evidence/)
  })

  it('allows instrumentation, isolated_test, trace_read, and dap probes', () => {
    const guard = new DebugGuard()
    for (const kind of ['instrumentation', 'isolated_test', 'trace_read', 'dap'] as const) {
      expect(() => guard.probeIsLegal({ action: 'collect', kind })).not.toThrow()
    }
  })
})

describe('DebugGuard.verdictIsHonest', () => {
  it('blocks a verdict with no captured observation hash', () => {
    const guard = new DebugGuard()
    const cycle: DebugCycle = { id: 'H1', status: 'open', hypothesis: 'h', prediction: 'p', observation: { captured: 'x', observation_sha256: null } }
    expect(() => guard.verdictIsHonest(cycle)).toThrow(/narration, not evidence/)
  })

  it('allows a verdict backed by a captured observation hash', () => {
    const guard = new DebugGuard()
    const cycle: DebugCycle = { id: 'H1', status: 'open', hypothesis: 'h', prediction: 'p', observation: { captured: 'x', observation_sha256: 'abc' } }
    expect(() => guard.verdictIsHonest(cycle)).not.toThrow()
  })
})

describe('DebugGuard.canWriteFix', () => {
  it('blocks when no cycle is confirmed', () => {
    const guard = new DebugGuard()
    const session = makeSession([{ id: 'H1', status: 'refuted', hypothesis: 'h', prediction: 'p', verdict: { prediction_held: false, result: 'REFUTED' } }])
    expect(() => guard.canWriteFix(session)).toThrow(/no confirmed hypothesis/)
  })

  it('blocks when fix is not tied to a confirmed cycle', () => {
    const guard = new DebugGuard()
    const session = makeSession([{ id: 'H2', status: 'confirmed', hypothesis: 'h', prediction: 'p', verdict: { prediction_held: true, result: 'CONFIRMED' } }])
    session.fix.authorized_by_cycle = 'H1'
    expect(() => guard.canWriteFix(session)).toThrow(/not tied to a confirmed cycle/)
  })

  it('allows a fix authorized by a confirmed cycle', () => {
    const guard = new DebugGuard()
    const session = makeSession([{ id: 'H2', status: 'confirmed', hypothesis: 'h', prediction: 'p', verdict: { prediction_held: true, result: 'CONFIRMED' } }])
    session.fix.authorized_by_cycle = 'H2'
    expect(() => guard.canWriteFix(session)).not.toThrow()
  })
})

describe('DebugGuard.escalateIfNeeded', () => {
  it('signals escalation once refuted cycles reach the budget', () => {
    const guard = new DebugGuard()
    const refuted = (id: string): DebugCycle => ({ id, status: 'refuted', hypothesis: 'h', prediction: 'p', verdict: { prediction_held: false, result: 'REFUTED' } })
    const session = makeSession([refuted('H1'), refuted('H2'), refuted('H3'), refuted('H4')])
    expect(guard.escalateIfNeeded(session)).toEqual({ escalate: true, reason: 'cycle budget exhausted' })
  })

  it('does not escalate under budget', () => {
    const guard = new DebugGuard()
    const session = makeSession([{ id: 'H1', status: 'refuted', hypothesis: 'h', prediction: 'p', verdict: { prediction_held: false, result: 'REFUTED' } }])
    expect(guard.escalateIfNeeded(session)).toEqual({ escalate: false })
  })
})

describe('checkSymptomResolved', () => {
  it('returns true when repro_cmd exits 0', () => {
    const session = makeSession()
    session.symptom.repro_cmd = 'true'
    expect(checkSymptomResolved(session, process.cwd())).toBe(true)
  })

  it('returns false when repro_cmd exits non-zero', () => {
    const session = makeSession()
    session.symptom.repro_cmd = 'false'
    expect(checkSymptomResolved(session, process.cwd())).toBe(false)
  })
})
