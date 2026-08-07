import { existsSync, mkdirSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'

export type AgentTarget = 'claude-code' | 'codex'

const AGENT_SKILLS_DIR: Record<AgentTarget, string> = {
  'claude-code': '.claude/skills',
  codex: '.codex/skills',
}

const SKILL_NAME = 'hammerhead-debug'

export interface InstallOptions {
  /** default: both claude-code and codex */
  agents?: AgentTarget[]
  /** default true — installs to the home directory (matching how ~/.claude/skills/loomkit-*
   *  already live). false installs relative to `cwd` instead, into a project's own
   *  .claude/skills//.codex/skills — for a project that wants the skill scoped locally. */
  global?: boolean
  /** base directory override — home dir when global, cwd when not. Exists mainly for tests. */
  cwd?: string
  /** override the source SKILL.md path — exists mainly for tests. */
  skillSourcePath?: string
}

export interface InstallResult {
  installed: Array<{ agent: AgentTarget; path: string }>
}

/** skill/SKILL.md sits one level above dist/ (mirrors src/'s depth) — this resolves
 *  correctly whether running from dist/install.js or (in tests) directly from src/. */
export function defaultSkillSourcePath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'skill', 'SKILL.md')
}

export function installSkill(opts: InstallOptions = {}): InstallResult {
  const agents = opts.agents ?? (['claude-code', 'codex'] as AgentTarget[])
  const isGlobal = opts.global ?? true
  const base = opts.cwd ?? (isGlobal ? homedir() : process.cwd())
  const sourcePath = opts.skillSourcePath ?? defaultSkillSourcePath()

  if (!existsSync(sourcePath)) {
    throw new Error(`skill source not found at ${sourcePath}`)
  }

  const installed: InstallResult['installed'] = []
  for (const agent of agents) {
    const targetDir = join(base, AGENT_SKILLS_DIR[agent], SKILL_NAME)
    mkdirSync(targetDir, { recursive: true })
    const targetPath = join(targetDir, 'SKILL.md')
    copyFileSync(sourcePath, targetPath)
    installed.push({ agent, path: targetPath })
  }
  return { installed }
}
