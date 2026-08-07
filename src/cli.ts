#!/usr/bin/env node
import { execFileSync } from 'child_process'
import { randomUUID } from 'crypto'
import { readdirSync } from 'fs'
import { createDebugLoopJson, readDebugLoopJson, writeDebugLoopJson } from './debug-loop.js'
import { DebugGuard, checkSymptomResolved } from './debug-guard.js'
import { runDapProbe } from './dap-probe.js'
import { installSkill, type AgentTarget } from './install.js'
import type { DebugCycle, DebugProbe } from './types.js'

const DEFAULT_DIR = '.hammerhead-debug'
const guard = new DebugGuard()

function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = args[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    } else {
      positional.push(a)
    }
  }
  return { positional, flags }
}

function boundRepoSha(cwd: string): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'unknown'
  }
}

function fail(message: string): never {
  process.stderr.write(`Error: ${message}\n`)
  process.exit(1)
}

function cmdOpen(flags: Record<string, string | boolean>): void {
  const symptom = typeof flags.symptom === 'string' ? flags.symptom : undefined
  const repro = typeof flags.repro === 'string' ? flags.repro : undefined
  if (!symptom || !repro) fail('open requires --symptom "<description>" --repro "<cmd>"')
  const dir = typeof flags.dir === 'string' ? flags.dir : DEFAULT_DIR
  const plan = typeof flags.plan === 'string' ? flags.plan : undefined
  const task = typeof flags.task === 'string' ? flags.task : undefined
  const sessionId = `dbg-${randomUUID().slice(0, 8)}`
  const session = createDebugLoopJson(dir, sessionId, {
    boundRepoSha: boundRepoSha(process.cwd()),
    servesTask: plan && task ? { plan, task } : null,
    symptom: { description: symptom, repro_cmd: repro },
  })
  process.stdout.write(JSON.stringify({ session_id: session.session_id, dir }, null, 2) + '\n')
}

function cmdHypothesis(positional: string[], flags: Record<string, string | boolean>): void {
  const [sessionId, hypothesis] = positional
  const predict = typeof flags.predict === 'string' ? flags.predict : undefined
  if (!sessionId || !hypothesis || !predict) {
    fail('hypothesis requires <session-id> "<hypothesis>" --predict "<prediction>"')
  }
  const dir = typeof flags.dir === 'string' ? flags.dir : DEFAULT_DIR
  const session = readDebugLoopJson(dir, sessionId)
  guard.canOpenCycle(session, { prediction: predict })
  const cycle: DebugCycle = { id: `c-${session.cycles.length + 1}`, status: 'open', hypothesis, prediction: predict }
  session.cycles.push(cycle)
  writeDebugLoopJson(dir, session)
  process.stdout.write(JSON.stringify({ cycle_id: cycle.id }, null, 2) + '\n')
}

async function cmdProbe(positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  const [sessionId] = positional
  const kind = typeof flags.kind === 'string' ? flags.kind : undefined
  if (!sessionId || !kind) fail('probe requires <session-id> --kind <dap|instrumentation|isolated_test|trace_read>')
  const dir = typeof flags.dir === 'string' ? flags.dir : DEFAULT_DIR
  const session = readDebugLoopJson(dir, sessionId)
  const openCycle = session.cycles.find(c => c.status === 'open')
  if (!openCycle) fail('no open cycle — run "hypothesis" first')

  const probe: DebugProbe = { action: typeof flags.action === 'string' ? flags.action : kind, kind: kind as DebugProbe['kind'] }
  guard.probeIsLegal(probe)

  if (kind === 'dap') {
    const script = typeof flags.script === 'string' ? flags.script : undefined
    const breakFlag = typeof flags.break === 'string' ? flags.break : undefined
    const evaluate = typeof flags.evaluate === 'string' ? flags.evaluate : undefined
    if (!breakFlag || !evaluate) fail('probe --kind dap requires --break <path:line> --evaluate "<expr>"')
    const [path, lineStr] = breakFlag!.split(':')
    probe.dap = { script, breakpoints: [{ path, line: parseInt(lineStr, 10) }], evaluate: evaluate! }
    const observation = await runDapProbe(probe.dap, { binPath: typeof flags['dap-bin'] === 'string' ? flags['dap-bin'] : undefined })
    openCycle!.probe = probe
    openCycle!.observation = observation
  } else {
    // instrumentation / isolated_test / trace_read probes are executed by the agent
    // itself (log instrumentation, a test file, reading a trace) — this CLI only
    // records the resulting observation, matching the guard's evidence-not-narration
    // requirement (verdictIsHonest needs a real observation_sha256, not a claim).
    const observationText = typeof flags.observation === 'string' ? flags.observation : undefined
    if (!observationText) fail(`probe --kind ${kind} requires --observation "<captured evidence text>"`)
    const { sha256String } = await import('./sha256.js')
    openCycle!.probe = probe
    openCycle!.observation = { captured: observationText!, observation_sha256: sha256String(observationText!) }
  }
  writeDebugLoopJson(dir, session)
  process.stdout.write(JSON.stringify(openCycle!.observation, null, 2) + '\n')
}

function cmdVerdict(positional: string[], flags: Record<string, string | boolean>): void {
  const [sessionId] = positional
  const result = typeof flags.result === 'string' ? flags.result : undefined
  if (!sessionId || (result !== 'CONFIRMED' && result !== 'REFUTED')) {
    fail('verdict requires <session-id> --result CONFIRMED|REFUTED [--reason "..."]')
  }
  const dir = typeof flags.dir === 'string' ? flags.dir : DEFAULT_DIR
  const session = readDebugLoopJson(dir, sessionId)
  const openCycle = session.cycles.find(c => c.status === 'open')
  if (!openCycle) fail('no open cycle')
  guard.verdictIsHonest(openCycle!)
  const reason = typeof flags.reason === 'string' ? flags.reason : undefined
  openCycle!.verdict = { prediction_held: result === 'CONFIRMED', result, reason }
  openCycle!.status = result === 'CONFIRMED' ? 'confirmed' : 'refuted'
  if (result === 'CONFIRMED') session.fix.authorized_by_cycle = openCycle!.id
  writeDebugLoopJson(dir, session)

  const escalation = guard.escalateIfNeeded(session)
  process.stdout.write(JSON.stringify({ cycle_id: openCycle!.id, status: openCycle!.status, escalation }, null, 2) + '\n')
}

function cmdFix(positional: string[], flags: Record<string, string | boolean>): void {
  const [sessionId] = positional
  const diffSha = typeof flags['diff-sha256'] === 'string' ? flags['diff-sha256'] : undefined
  if (!sessionId || !diffSha) fail('fix requires <session-id> --diff-sha256 <hash>')
  const dir = typeof flags.dir === 'string' ? flags.dir : DEFAULT_DIR
  const session = readDebugLoopJson(dir, sessionId)
  guard.canWriteFix(session)
  session.fix.applied = true
  session.fix.diff_sha256 = diffSha!
  writeDebugLoopJson(dir, session)
  process.stdout.write(JSON.stringify({ authorized: true, fix: session.fix }, null, 2) + '\n')
}

function cmdStatus(positional: string[], flags: Record<string, string | boolean>): void {
  const [sessionId] = positional
  if (!sessionId) fail('status requires <session-id>')
  const dir = typeof flags.dir === 'string' ? flags.dir : DEFAULT_DIR
  const session = readDebugLoopJson(dir, sessionId)
  process.stdout.write(JSON.stringify({ session, escalation: guard.escalateIfNeeded(session) }, null, 2) + '\n')
}

function cmdCheck(positional: string[], flags: Record<string, string | boolean>): void {
  const [sessionId] = positional
  if (!sessionId) fail('check requires <session-id>')
  const dir = typeof flags.dir === 'string' ? flags.dir : DEFAULT_DIR
  const session = readDebugLoopJson(dir, sessionId)
  const resolved = checkSymptomResolved(session, process.cwd())
  process.stdout.write(JSON.stringify({ resolved }, null, 2) + '\n')
}

function cmdList(flags: Record<string, string | boolean>): void {
  const dir = typeof flags.dir === 'string' ? flags.dir : DEFAULT_DIR
  let files: string[] = []
  try {
    files = readdirSync(dir).filter(f => f.endsWith('.json'))
  } catch {
    // no sessions dir yet
  }
  process.stdout.write(JSON.stringify({ sessions: files.map(f => f.replace(/\.json$/, '')) }, null, 2) + '\n')
}

const KNOWN_AGENTS: AgentTarget[] = ['claude-code', 'codex']

function cmdInstall(flags: Record<string, string | boolean>): void {
  let agents: AgentTarget[] | undefined
  if (typeof flags.agent === 'string') {
    if (!KNOWN_AGENTS.includes(flags.agent as AgentTarget)) {
      fail(`unknown --agent "${flags.agent}" — expected one of: ${KNOWN_AGENTS.join(', ')}`)
    }
    agents = [flags.agent as AgentTarget]
  }
  const global = !flags.project
  const result = installSkill({ agents, global })
  process.stdout.write(
    `Installed hammerhead-debug skill:\n` + result.installed.map(i => `  [${i.agent}] ${i.path}`).join('\n') + '\n',
  )
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2)
  const { positional, flags } = parseFlags(rest)

  switch (command) {
    case 'open':
      return cmdOpen(flags)
    case 'hypothesis':
      return cmdHypothesis(positional, flags)
    case 'probe':
      return await cmdProbe(positional, flags)
    case 'verdict':
      return cmdVerdict(positional, flags)
    case 'fix':
      return cmdFix(positional, flags)
    case 'status':
      return cmdStatus(positional, flags)
    case 'check':
      return cmdCheck(positional, flags)
    case 'list':
      return cmdList(flags)
    case 'install':
      return cmdInstall(flags)
    default:
      process.stdout.write(`hammerhead-debug — hypothesis-gated debugging, DAP-native

Usage:
  hammerhead-debug install [--agent claude-code|codex] [--project]
  hammerhead-debug open --symptom "<desc>" --repro "<cmd>" [--plan <p> --task <t>] [--dir <dir>]
  hammerhead-debug hypothesis <session-id> "<hypothesis>" --predict "<prediction>"
  hammerhead-debug probe <session-id> --kind dap --break <path:line> --evaluate "<expr>" [--script <path>]
  hammerhead-debug probe <session-id> --kind instrumentation|isolated_test|trace_read --observation "<captured evidence>"
  hammerhead-debug verdict <session-id> --result CONFIRMED|REFUTED [--reason "..."]
  hammerhead-debug fix <session-id> --diff-sha256 <hash>
  hammerhead-debug status <session-id>
  hammerhead-debug check <session-id>
  hammerhead-debug list
`)
      process.exit(command ? 1 : 0)
  }
}

main().catch(e => fail((e as Error).message))
