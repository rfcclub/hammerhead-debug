import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export interface StoppedLocation {
  file: string
  line: number
  function: string
}

export interface StoppedData {
  reason: string
  location: StoppedLocation
  source: Array<{ line: number; text: string; current?: boolean }>
  locals?: Array<{ name: string; type: string; value: string }>
  stack: Array<{ frame: number; function: string; file: string; line: number }>
  warnings?: string[]
}

export interface EvalData {
  eval_result: { value: string; type: string }
}

export type DapCliResult =
  | { kind: 'stopped'; data: StoppedData }
  | { kind: 'ok'; data: unknown }
  | { kind: 'terminated'; exitCode?: number; output?: string; raw: string }
  | { kind: 'error'; message: string; raw: string }

/**
 * Runs one `dap` CLI invocation and classifies its output.
 *
 * `debug-skill`'s `dap` only emits parseable JSON for `status: "ok"` / `"stopped"`
 * responses (verified against real output, 2026-08-03) — `"error"` and `"terminated"`
 * always print plain text starting with "Error: " / "Program terminated", even with
 * `--json`. A naive `JSON.parse(stdout)` throws on those paths; this function
 * classifies by prefix first so callers never have to guess.
 */
export type DapCliRunner = (args: string[]) => Promise<{ stdout: string; exitCode: number }>

export const defaultDapCliRunner =
  (binPath: string): DapCliRunner =>
  async (args: string[]) => {
    try {
      const { stdout } = await execFileAsync(binPath, args, { timeout: 60_000 })
      return { stdout, exitCode: 0 }
    } catch (e) {
      const err = e as { code?: number; stdout?: string }
      return { stdout: err.stdout ?? '', exitCode: err.code ?? 1 }
    }
  }

export function classifyDapOutput(stdout: string): DapCliResult {
  const trimmed = stdout.trim()
  if (trimmed.startsWith('Error:')) {
    return { kind: 'error', message: trimmed.replace(/^Error:\s*/, ''), raw: stdout }
  }
  if (trimmed.startsWith('Program terminated')) {
    const exitMatch = /Exit code:\s*(\d+)/.exec(trimmed)
    return {
      kind: 'terminated',
      exitCode: exitMatch ? parseInt(exitMatch[1], 10) : undefined,
      output: trimmed,
      raw: stdout,
    }
  }
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    if ('reason' in parsed && 'location' in parsed) {
      return { kind: 'stopped', data: parsed as unknown as StoppedData }
    }
    return { kind: 'ok', data: parsed }
  } catch {
    // "dap stop" and other bare-status commands print "OK\n", not JSON, even with --json.
    return { kind: 'ok', data: trimmed }
  }
}

export async function runDapCli(run: DapCliRunner, args: string[]): Promise<DapCliResult> {
  const { stdout } = await run([...args, '--json'])
  return classifyDapOutput(stdout)
}
