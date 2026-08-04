import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createDebugLoopJson, readDebugLoopJson, writeDebugLoopJson } from '../src/debug-loop.ts'

let tmpDir: string

beforeEach(() => {
  tmpDir = join(tmpdir(), `hammerhead-debugloop-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('debug-loop', () => {
  it('createDebugLoopJson creates a valid session', () => {
    const session = createDebugLoopJson(tmpDir, 'debug/PCC-4821', {
      boundRepoSha: 'd6ef275',
      servesTask: { plan: 'checkout-promo', task: 'TASK-3' },
      symptom: { description: 'checkout returns null total', repro_cmd: 'pytest -x' },
    })
    expect(session.session_id).toBe('debug/PCC-4821')
    expect(session.cycles).toEqual([])
    expect(session.fix.authorized_by_cycle).toBeNull()
  })

  it('readDebugLoopJson reads back a nested session id', () => {
    createDebugLoopJson(tmpDir, 'debug/PCC-4821', {
      boundRepoSha: 'd6ef275',
      servesTask: { plan: 'checkout-promo', task: 'TASK-3' },
      symptom: { description: 'x', repro_cmd: 'true' },
    })
    const session = readDebugLoopJson(tmpDir, 'debug/PCC-4821')
    expect(session.serves_task.task).toBe('TASK-3')
  })

  it('readDebugLoopJson throws when session does not exist', () => {
    expect(() => readDebugLoopJson(tmpDir, 'debug/missing')).toThrow(/not found/)
  })

  it('writeDebugLoopJson round-trips mutations', () => {
    const session = createDebugLoopJson(tmpDir, 'debug/PCC-4821', {
      boundRepoSha: 'd6ef275',
      servesTask: { plan: 'checkout-promo', task: 'TASK-3' },
      symptom: { description: 'x', repro_cmd: 'true' },
    })
    session.cycles.push({
      id: 'H1',
      status: 'refuted',
      hypothesis: 'h',
      prediction: 'p',
      verdict: { prediction_held: false, result: 'REFUTED' },
    })
    writeDebugLoopJson(tmpDir, session)
    const reread = readDebugLoopJson(tmpDir, 'debug/PCC-4821')
    expect(reread.cycles).toHaveLength(1)
    expect(reread.cycles[0].id).toBe('H1')
  })
})
