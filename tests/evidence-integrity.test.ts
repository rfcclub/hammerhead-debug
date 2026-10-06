import { it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { DebugGuard } from '../src/debug-guard.js'
import type { DebugCycle, DebugLoopJson } from '../src/types.js'
const hash = (text: string) => createHash('sha256').update(text).digest('hex')
const guard = new DebugGuard()
function cycle(): DebugCycle { return { id: 'c-1', status: 'confirmed', hypothesis: 'value is 41', prediction: 'assertion reports 41 != 42', observation: { captured: 'actual=41 expected=42', observation_sha256: hash('actual=41 expected=42') }, verdict: { result: 'CONFIRMED', prediction_held: true } } }
function session(cycles: DebugCycle[] = [cycle()]): DebugLoopJson { return { schema_version: '1.0', session_id: 'dbg-fixture', bound_repo_sha: 'fixture', serves_task: null, symptom: { description: 'wrong answer', repro_cmd: 'node check.cjs', repro_sha256: null }, cycles, fix: { authorized_by_cycle: 'c-1', applied: false, diff_sha256: null }, escalation: { max_refuted_cycles: 4, on_exhaust: 'STOP' } } }
it('exhausted-budget: rejects a fifth hypothesis after four refutations', () => {
 const s = session(Array.from({ length: 4 }, (_, n) => ({ ...cycle(), id: `c-${n}`, status: 'refuted' })))
 expect(guard.escalateIfNeeded(s).escalate).toBe(true)
 expect(() => guard.canOpenCycle(s, { prediction: 'another guess' })).toThrow(/budget|exhaust/i)
 const under = session(s.cycles.slice(0, 3)); expect(() => guard.canOpenCycle(under, { prediction: 'falsifiable' })).not.toThrow()
})
it('invalid-budget: rejects invalid refutation limits', () => {
 for (const budget of [0, -1, 1.5, NaN, Infinity]) { const s = session([]); s.escalation.max_refuted_cycles = budget; expect(() => guard.canOpenCycle(s, { prediction: 'p' })).toThrow(/budget/i) }
})
it('tampered-observation: refuses verdict and fix after captured text changes', () => {
 const c = cycle(); c.observation!.captured += ' edited'; expect(() => guard.verdictIsHonest(c)).toThrow(/observation|hash|integrity/i)
 expect(() => guard.canWriteFix(session([c]))).toThrow(/observation|hash|integrity/i)
 const intact = cycle(); expect(() => guard.verdictIsHonest(intact)).not.toThrow(); expect(() => guard.canWriteFix(session([intact]))).not.toThrow()
})
it('empty-observation: matching hash does not make whitespace evidence', () => {
 for (const captured of ['', '  \n']) { const c = cycle(); c.observation = { captured, observation_sha256: hash(captured) }; expect(() => guard.verdictIsHonest(c)).toThrow(/observation|captured/i) }
})
it('inconsistent-verdict: rejects a refuted result disguised as confirmed', () => {
 const c = cycle(); c.verdict!.result = 'REFUTED'; expect(() => guard.canWriteFix(session([c]))).toThrow(/confirmed|cycle/i)
})
it('actual-cli-handoff: requires captured confirmation and reruns a real repro', () => {
 const root = mkdtempSync(join(tmpdir(), 'hammerhead-cli-real-'))
 const cli = process.env.HAMMERHEAD_TEST_CLI ?? resolve('dist/cli.js')
 const dir = join(root, 'orca/changes/demo')
 const run = (args: string[]) => spawnSync(process.execPath, [cli, ...args, '--dir', dir], { cwd: root, encoding: 'utf8', timeout: 10000 })
 try {
  writeFileSync(join(root, 'answer.cjs'), 'module.exports=41')
  writeFileSync(join(root, 'check.cjs'), "require('node:assert/strict').equal(require('./answer.cjs'),42)")
  const repro = spawnSync(process.execPath, ['check.cjs'], { cwd: root, encoding: 'utf8' }); expect(repro.status).toBe(1); expect(repro.stderr).toContain('AssertionError')
  const opened = run(['open', '--symptom', 'answer is 41 instead of 42', '--repro', 'node check.cjs', '--plan', 'demo', '--task', 'T1']); expect(opened.status).toBe(0)
  const id = JSON.parse(opened.stdout).session_id
  expect(run(['fix', id, '--diff-sha256', hash('fixture fix')]).status).toBe(1)
  expect(run(['hypothesis', id, 'answer implementation is 41', '--predict', 'assertion reports actual 41 expected 42']).status).toBe(0)
  expect(run(['verdict', id, '--result', 'CONFIRMED']).status).toBe(1)
  const observed = run(['probe', id, '--kind', 'isolated_test', '--observation', repro.stderr]); expect(observed.status).toBe(0)
  expect(JSON.parse(observed.stdout).observation_sha256).toBe(hash(repro.stderr))
  expect(run(['verdict', id, '--result', 'CONFIRMED', '--reason', 'actual assertion shows 41 versus 42']).status).toBe(0)
  const sessionPath = join(dir, `${id}.json`), original = readFileSync(sessionPath, 'utf8')
  const tampered = JSON.parse(original); tampered.cycles[0].observation.captured += ' edited'
  writeFileSync(sessionPath, JSON.stringify(tampered))
  expect(run(['fix', id, '--diff-sha256', hash('fixture fix')]).status).toBe(1)
  writeFileSync(sessionPath, original)
  expect(JSON.parse(run(['check', id]).stdout).resolved).toBe(false)
  writeFileSync(join(root, 'answer.cjs'), 'module.exports=42')
  expect(run(['fix', id, '--diff-sha256', hash('fixture fix')]).status).toBe(0)
  expect(JSON.parse(run(['check', id]).stdout).resolved).toBe(true)
  const saved = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8'))
  expect(saved.cycles[0].observation.captured).toBe(repro.stderr); expect(saved.serves_task).toEqual({ plan: 'demo', task: 'T1' })
  const budgetId = JSON.parse(run(['open', '--symptom', 'bounded investigation', '--repro', 'node check.cjs']).stdout).session_id
  for (let n = 0; n < 4; n++) {
   expect(run(['hypothesis', budgetId, `hypothesis-${n}`, '--predict', 'value would be 99']).status).toBe(0)
   expect(run(['probe', budgetId, '--kind', 'isolated_test', '--observation', repro.stderr]).status).toBe(0)
   expect(run(['verdict', budgetId, '--result', 'REFUTED', '--reason', 'actual assertion shows 41, not predicted 99']).status).toBe(0)
  }
  expect(run(['hypothesis', budgetId, 'fifth guess', '--predict', 'different value']).status).toBe(1)

 } finally { rmSync(root, { recursive: true, force: true }) }
})
