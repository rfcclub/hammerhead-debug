import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { installSkill } from '../src/install.ts'

let tmpDir: string
let fakeSkillSource: string

beforeEach(() => {
  tmpDir = join(tmpdir(), `hammerhead-install-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(tmpDir, { recursive: true })
  fakeSkillSource = join(tmpDir, 'fake-skill', 'SKILL.md')
  mkdirSync(join(tmpDir, 'fake-skill'), { recursive: true })
  writeFileSync(fakeSkillSource, '---\nname: hammerhead-debug\n---\nreal skill content\n')
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('installSkill', () => {
  it('installs to both claude-code and codex by default, real files with real content', () => {
    const homeDir = join(tmpDir, 'fake-home')
    const result = installSkill({ cwd: homeDir, skillSourcePath: fakeSkillSource })

    expect(result.installed).toHaveLength(2)
    expect(result.installed.map(i => i.agent).sort()).toEqual(['claude-code', 'codex'])

    const claudePath = join(homeDir, '.claude', 'skills', 'hammerhead-debug', 'SKILL.md')
    const codexPath = join(homeDir, '.codex', 'skills', 'hammerhead-debug', 'SKILL.md')
    expect(existsSync(claudePath)).toBe(true)
    expect(existsSync(codexPath)).toBe(true)
    expect(readFileSync(claudePath, 'utf-8')).toContain('real skill content')
    expect(readFileSync(codexPath, 'utf-8')).toContain('real skill content')
  })

  it('installs to only the requested agent when agents is restricted', () => {
    const homeDir = join(tmpDir, 'fake-home')
    const result = installSkill({ agents: ['claude-code'], cwd: homeDir, skillSourcePath: fakeSkillSource })

    expect(result.installed).toEqual([
      { agent: 'claude-code', path: join(homeDir, '.claude', 'skills', 'hammerhead-debug', 'SKILL.md') },
    ])
    expect(existsSync(join(homeDir, '.codex', 'skills', 'hammerhead-debug', 'SKILL.md'))).toBe(false)
  })

  it('throws clearly when the skill source file does not exist', () => {
    expect(() =>
      installSkill({ cwd: tmpDir, skillSourcePath: join(tmpDir, 'does-not-exist.md') }),
    ).toThrow(/not found/)
  })

  it('is idempotent — installing twice overwrites cleanly, does not throw or duplicate', () => {
    const homeDir = join(tmpDir, 'fake-home')
    installSkill({ agents: ['claude-code'], cwd: homeDir, skillSourcePath: fakeSkillSource })
    writeFileSync(fakeSkillSource, '---\nname: hammerhead-debug\n---\nupdated content\n')
    const result = installSkill({ agents: ['claude-code'], cwd: homeDir, skillSourcePath: fakeSkillSource })

    expect(result.installed).toHaveLength(1)
    const content = readFileSync(result.installed[0].path, 'utf-8')
    expect(content).toContain('updated content')
    expect(content).not.toContain('real skill content')
  })

  it('defaultSkillSourcePath resolves to the real skill/SKILL.md next to this package', async () => {
    const { defaultSkillSourcePath } = await import('../src/install.ts')
    const path = defaultSkillSourcePath()
    expect(path.endsWith('skill/SKILL.md') || path.endsWith('skill\\SKILL.md')).toBe(true)
    expect(existsSync(path)).toBe(true)
  })
})
