import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import type { DebugLoopJson } from './types.js'

export function createDebugLoopJson(
  changeDir: string,
  sessionId: string,
  opts: {
    boundRepoSha: string
    servesTask: { plan: string; task: string }
    symptom: { description: string; repro_cmd: string }
  },
): DebugLoopJson {
  const session: DebugLoopJson = {
    schema_version: '1.0',
    session_id: sessionId,
    bound_repo_sha: opts.boundRepoSha,
    serves_task: opts.servesTask,
    symptom: { description: opts.symptom.description, repro_cmd: opts.symptom.repro_cmd, repro_sha256: null },
    cycles: [],
    fix: { authorized_by_cycle: null, applied: false, diff_sha256: null },
    escalation: {
      max_refuted_cycles: 4,
      on_exhaust: 'STOP and escalate — hand session + all cycles to stronger model or human',
    },
  }
  writeDebugLoopJson(changeDir, session)
  return session
}

export function readDebugLoopJson(changeDir: string, sessionId: string): DebugLoopJson {
  const p = debugLoopPath(changeDir, sessionId)
  if (!existsSync(p)) throw new Error(`debug-loop session not found at ${p}`)
  return JSON.parse(readFileSync(p, 'utf-8')) as DebugLoopJson
}

export function writeDebugLoopJson(changeDir: string, session: DebugLoopJson): void {
  const p = debugLoopPath(changeDir, session.session_id)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(session, null, 2) + '\n')
}

function debugLoopPath(changeDir: string, sessionId: string): string {
  return join(changeDir, `${sessionId}.json`)
}
