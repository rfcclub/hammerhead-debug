import { sha256String } from './sha256.js'
import type { DapProbeSpec, DebugObservation } from './types.js'
import { defaultDapCliRunner, runDapCli, type DapCliRunner } from './dap-cli.js'

function buildDebugArgs(spec: DapProbeSpec): string[] {
  const args = ['debug']
  if (spec.script) args.push(spec.script)
  for (const bp of spec.breakpoints) {
    const flag = bp.condition ? `${bp.path}:${bp.line}:${bp.condition}` : `${bp.path}:${bp.line}`
    args.push('--break', flag)
  }
  if (spec.attach) args.push('--attach', spec.attach)
  if (spec.pid) args.push('--pid', String(spec.pid))
  if (spec.backend) args.push('--backend', spec.backend)
  if (spec.stopOnEntry) args.push('--stop-on-entry')
  return args
}

/**
 * Drives `debug-skill`'s `dap` CLI through one probe: start (blocks until stopped or
 * exited), evaluate the requested expression, stop. Replaces the earlier hand-rolled
 * `DapClient` (raw DAP wire protocol) — `dap` already does this properly (daemon-backed,
 * multi-backend auto-detection, conditional breakpoints) and re-implementing it was
 * duplicated engineering for a strictly worse result (thoor, 2026-08-04, after reviewing
 * ~/repo/debug-skill as prior art).
 */
export async function runDapProbe(
  spec: DapProbeSpec,
  opts: { binPath?: string; runner?: DapCliRunner } = {},
): Promise<DebugObservation> {
  const run = opts.runner ?? defaultDapCliRunner(opts.binPath ?? 'dap')

  const debugResult = await runDapCli(run, buildDebugArgs(spec))

  try {
    if (debugResult.kind === 'error') {
      throw new Error(`dap debug failed: ${debugResult.message}`)
    }
    if (debugResult.kind === 'terminated') {
      const captured = `terminated(exit ${debugResult.exitCode ?? 'unknown'}): program exited before hitting a breakpoint`
      return { captured, observation_sha256: sha256String(captured) }
    }
    if (debugResult.kind !== 'stopped') {
      throw new Error(`dap debug returned unexpected result kind: ${debugResult.kind}`)
    }

    const evalResult = await runDapCli(run, ['eval', spec.evaluate])
    if (evalResult.kind !== 'ok' || typeof evalResult.data !== 'object' || evalResult.data === null) {
      const captured = `stopped(${debugResult.data.reason}) at ${debugResult.data.location.file}:${debugResult.data.location.line} — eval "${spec.evaluate}" failed`
      return { captured, observation_sha256: sha256String(captured) }
    }

    const evalData = evalResult.data as { eval_result?: { value: string; type: string } }
    const value = evalData.eval_result?.value ?? '<no value>'
    const captured = `stopped(${debugResult.data.reason}) at ${debugResult.data.location.file}:${debugResult.data.location.line}: ${spec.evaluate} = ${value}`
    return { captured, observation_sha256: sha256String(captured) }
  } finally {
    // Best-effort — the daemon may already have exited on its own (program ran to completion).
    try {
      await runDapCli(run, ['stop'])
    } catch {
      // ignore
    }
  }
}
