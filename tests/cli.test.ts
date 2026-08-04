import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'

const cliPath = fileURLToPath(new URL('../dist/cli.js', import.meta.url))

let cwd: string
let sessionsDir: string

function run(args: string[]): { stdout: string; status: number } {
  try {
    const stdout = execFileSync('node', [cliPath, ...args], { cwd, encoding: 'utf-8' })
    return { stdout, status: 0 }
  } catch (e) {
    const err = e as { stdout?: string; status?: number }
    return { stdout: err.stdout ?? '', status: err.status ?? 1 }
  }
}

beforeEach(() => {
  cwd = join(tmpdir(), `hammerhead-cli-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  sessionsDir = join(cwd, '.hammerhead-debug')
  mkdirSync(cwd, { recursive: true })
})

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true })
})

describe('hammerhead-debug CLI', () => {
  it('runs the full hypothesis-gated loop: open → hypothesis → probe → verdict → fix', () => {
    const opened = run(['open', '--symptom', 'checkout total is wrong', '--repro', 'true'])
    expect(opened.status).toBe(0)
    const { session_id: sessionId } = JSON.parse(opened.stdout) as { session_id: string }
    expect(sessionId).toMatch(/^dbg-/)
    expect(existsSync(join(sessionsDir, `${sessionId}.json`))).toBe(true)

    const hyp = run(['hypothesis', sessionId, 'discount applied twice', '--predict', 'total should be 100, not 90'])
    expect(hyp.status).toBe(0)
    expect(JSON.parse(hyp.stdout)).toEqual({ cycle_id: 'c-1' })

    const probe = run(['probe', sessionId, '--kind', 'instrumentation', '--observation', 'log shows discount applied at line 42 and line 58'])
    expect(probe.status).toBe(0)
    const observation = JSON.parse(probe.stdout) as { captured: string; observation_sha256: string }
    expect(observation.captured).toContain('discount applied')
    expect(observation.observation_sha256).toBeTruthy()

    const verdict = run(['verdict', sessionId, '--result', 'CONFIRMED', '--reason', 'evidence matches prediction'])
    expect(verdict.status).toBe(0)
    expect(JSON.parse(verdict.stdout)).toMatchObject({ cycle_id: 'c-1', status: 'confirmed' })

    const fix = run(['fix', sessionId, '--diff-sha256', 'abc123'])
    expect(fix.status).toBe(0)
    expect(JSON.parse(fix.stdout)).toMatchObject({ authorized: true, fix: { applied: true, diff_sha256: 'abc123' } })

    const status = run(['status', sessionId])
    expect(status.status).toBe(0)
    const finalSession = (JSON.parse(status.stdout) as { session: { cycles: unknown[] } }).session
    expect(finalSession.cycles).toHaveLength(1)
  })

  it('fix without a confirmed cycle is rejected by the guard, not silently allowed', () => {
    const opened = run(['open', '--symptom', 'x', '--repro', 'true'])
    const { session_id: sessionId } = JSON.parse(opened.stdout) as { session_id: string }
    const fix = run(['fix', sessionId, '--diff-sha256', 'abc123'])
    expect(fix.status).toBe(1)
  })

  it('opening a second hypothesis while one is still open is rejected', () => {
    const opened = run(['open', '--symptom', 'x', '--repro', 'true'])
    const { session_id: sessionId } = JSON.parse(opened.stdout) as { session_id: string }
    run(['hypothesis', sessionId, 'first', '--predict', 'p1'])
    const second = run(['hypothesis', sessionId, 'second', '--predict', 'p2'])
    expect(second.status).toBe(1)
  })

  it('verdict without a captured observation is rejected (narration is not evidence)', () => {
    const opened = run(['open', '--symptom', 'x', '--repro', 'true'])
    const { session_id: sessionId } = JSON.parse(opened.stdout) as { session_id: string }
    run(['hypothesis', sessionId, 'h', '--predict', 'p'])
    const verdict = run(['verdict', sessionId, '--result', 'CONFIRMED'])
    expect(verdict.status).toBe(1)
  })

  it('a REFUTED verdict does not authorize a fix', () => {
    const opened = run(['open', '--symptom', 'x', '--repro', 'true'])
    const { session_id: sessionId } = JSON.parse(opened.stdout) as { session_id: string }
    run(['hypothesis', sessionId, 'h', '--predict', 'p'])
    run(['probe', sessionId, '--kind', 'instrumentation', '--observation', 'no evidence of the predicted cause'])
    run(['verdict', sessionId, '--result', 'REFUTED'])
    const fix = run(['fix', sessionId, '--diff-sha256', 'abc'])
    expect(fix.status).toBe(1)
  })

  it('list reflects sessions actually written to disk', () => {
    const { session_id: id1 } = JSON.parse(run(['open', '--symptom', 'a', '--repro', 'true']).stdout) as { session_id: string }
    const { session_id: id2 } = JSON.parse(run(['open', '--symptom', 'b', '--repro', 'true']).stdout) as { session_id: string }
    const list = JSON.parse(run(['list']).stdout) as { sessions: string[] }
    expect(list.sessions.sort()).toEqual([id1, id2].sort())
  })

  it('open with no --plan/--task creates a standalone session (serves_task: null)', () => {
    const { session_id: sessionId } = JSON.parse(run(['open', '--symptom', 'x', '--repro', 'true']).stdout) as { session_id: string }
    const status = JSON.parse(run(['status', sessionId]).stdout) as { session: { serves_task: unknown } }
    expect(status.session.serves_task).toBeNull()
  })

  it('unknown command prints usage and exits non-zero', () => {
    const result = run(['bogus-command'])
    expect(result.status).toBe(1)
  })
})
