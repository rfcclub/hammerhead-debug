import { execFileSync } from 'child_process'
import type { DebugCycle, DebugLoopJson, DebugProbe } from './types.js'

const LEGAL_PROBE_KINDS = ['instrumentation', 'isolated_test', 'trace_read', 'dap']

export class DebugGuard {
  canOpenCycle(session: DebugLoopJson, next: Pick<DebugCycle, 'prediction'>): void {
    if (!next.prediction) {
      throw new Error('hypothesis has no prediction — not falsifiable, not a hypothesis')
    }
    if (session.cycles.some(c => c.status === 'open')) {
      throw new Error('resolve the open cycle (confirm/refute) before opening another')
    }
  }

  probeIsLegal(probe: DebugProbe): void {
    if (!LEGAL_PROBE_KINDS.includes(probe.kind)) {
      throw new Error('probe must collect evidence, not modify source-under-repair')
    }
  }

  verdictIsHonest(cycle: DebugCycle): void {
    if (!cycle.observation?.observation_sha256) {
      throw new Error('verdict without a captured observation — narration, not evidence')
    }
  }

  canWriteFix(session: DebugLoopJson): void {
    const confirmed = session.cycles.filter(c => c.status === 'confirmed' && c.verdict?.prediction_held === true)
    if (confirmed.length === 0) {
      throw new Error('no confirmed hypothesis — collect evidence before fixing')
    }
    if (!confirmed.some(c => c.id === session.fix.authorized_by_cycle)) {
      throw new Error('fix not tied to a confirmed cycle')
    }
  }

  escalateIfNeeded(session: DebugLoopJson): { escalate: boolean; reason?: string } {
    const refuted = session.cycles.filter(c => c.status === 'refuted').length
    if (refuted >= session.escalation.max_refuted_cycles) {
      return { escalate: true, reason: 'cycle budget exhausted' }
    }
    return { escalate: false }
  }
}

export function checkSymptomResolved(session: DebugLoopJson, cwd: string): boolean {
  try {
    execFileSync('sh', ['-c', session.symptom.repro_cmd], { cwd, stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}
