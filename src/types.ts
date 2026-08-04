export type CycleStatus = 'open' | 'confirmed' | 'refuted'
export type ProbeKind = 'instrumentation' | 'isolated_test' | 'trace_read' | 'dap'

export interface DebugProbe {
  action: string
  kind: ProbeKind
  dap?: DapProbeSpec
}

export interface DapProbeSpec {
  /** Script to debug, or omit when using `attach`/`pid`. */
  script?: string
  /** host:port of an already-running remote DAP server (debug-skill's `dap --attach`). */
  attach?: string
  /** PID of an already-running process to attach to (debug-skill's `dap --pid`). */
  pid?: number
  /** Debugger backend override (debugpy, dlv, js-debug, lldb-dap). Auto-detected from
   *  `script`'s extension when omitted — matches debug-skill's own auto-detection. */
  backend?: string
  breakpoints: { path: string; line: number; condition?: string }[]
  evaluate: string
  stopOnEntry?: boolean
}

export interface DebugObservation {
  captured: string
  observation_sha256: string | null
}

export interface DebugVerdict {
  prediction_held: boolean | null
  result: 'CONFIRMED' | 'REFUTED' | null
  reason?: string
}

export interface DebugCycle {
  id: string
  status: CycleStatus
  hypothesis: string
  prediction: string
  probe?: DebugProbe
  observation?: DebugObservation
  verdict?: DebugVerdict
}

export interface DebugSymptom {
  description: string
  repro_cmd: string
  repro_sha256: string | null
}

export interface DebugFix {
  authorized_by_cycle: string | null
  applied: boolean
  diff_sha256: string | null
}

export interface DebugEscalation {
  max_refuted_cycles: number
  on_exhaust: string
  complexity_tripwire?: string
}

export interface DebugLoopJson {
  schema_version: '1.0'
  session_id: string
  bound_repo_sha: string
  /** null for a standalone session opened directly by an agent (not tied to a
   *  loomkit-managed plan task) — see debug-loop-skill-layer. */
  serves_task: { plan: string; task: string } | null
  symptom: DebugSymptom
  cycles: DebugCycle[]
  fix: DebugFix
  escalation: DebugEscalation
}
