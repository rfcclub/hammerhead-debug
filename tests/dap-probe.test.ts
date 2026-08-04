import { describe, it, expect } from 'vitest'
import { runDapProbe } from '../src/dap-probe.ts'
import type { DapCliRunner } from '../src/dap-cli.ts'

const STOPPED_JSON = JSON.stringify({
  reason: 'breakpoint',
  location: { file: 'app.py', line: 2, function: 'add' },
  source: [{ line: 2, text: '    result = a + b', current: true }],
  stack: [{ frame: 0, function: 'add', file: 'app.py', line: 2 }],
})
const EVAL_JSON = JSON.stringify({ eval_result: { value: '5', type: 'int' } })
const TERMINATED_TEXT = 'Program terminated\nExit code: 0\n'
const ERROR_TEXT = 'Error: starting debug adapter: some failure\n'

function scriptedRunner(responses: string[]): { runner: DapCliRunner; calls: string[][] } {
  const calls: string[][] = []
  let i = 0
  const runner: DapCliRunner = async (args) => {
    calls.push(args)
    const stdout = responses[Math.min(i, responses.length - 1)]
    i++
    return { stdout, exitCode: 0 }
  }
  return { runner, calls }
}

describe('runDapProbe', () => {
  it('drives debug → eval → stop and returns a hashed observation on a real stop+eval', async () => {
    const { runner, calls } = scriptedRunner([STOPPED_JSON, EVAL_JSON, 'OK\n'])
    const observation = await runDapProbe(
      { script: 'app.py', breakpoints: [{ path: 'app.py', line: 2 }], evaluate: 'a + b' },
      { runner },
    )
    expect(observation.captured).toBe('stopped(breakpoint) at app.py:2: a + b = 5')
    expect(observation.observation_sha256).not.toBeNull()
    expect(calls[0]).toEqual(['debug', 'app.py', '--break', 'app.py:2', '--json'])
    expect(calls[1]).toEqual(['eval', 'a + b', '--json'])
    expect(calls[2]).toEqual(['stop', '--json'])
  })

  it('formats a conditional breakpoint as path:line:condition', async () => {
    const { runner, calls } = scriptedRunner([STOPPED_JSON, EVAL_JSON, 'OK\n'])
    await runDapProbe(
      { script: 'app.py', breakpoints: [{ path: 'app.py', line: 2, condition: 'x > 5' }], evaluate: 'x' },
      { runner },
    )
    expect(calls[0]).toContain('app.py:2:x > 5')
  })

  it('program exits before hitting a breakpoint → captures termination, still calls stop', async () => {
    const { runner, calls } = scriptedRunner([TERMINATED_TEXT, 'OK\n'])
    const observation = await runDapProbe(
      { script: 'app.py', breakpoints: [{ path: 'app.py', line: 999 }], evaluate: 'x' },
      { runner },
    )
    expect(observation.captured).toContain('terminated')
    expect(observation.captured).toContain('exit 0')
    expect(calls.at(-1)).toEqual(['stop', '--json'])
  })

  it('dap debug itself erroring throws, but still calls stop in finally', async () => {
    const { runner, calls } = scriptedRunner([ERROR_TEXT, 'OK\n'])
    await expect(
      runDapProbe({ script: 'app.py', breakpoints: [{ path: 'app.py', line: 1 }], evaluate: 'x' }, { runner }),
    ).rejects.toThrow('dap debug failed')
    expect(calls.at(-1)).toEqual(['stop', '--json'])
  })

  it('eval failing after a successful stop still returns an observation, not a throw', async () => {
    const { runner } = scriptedRunner([STOPPED_JSON, ERROR_TEXT, 'OK\n'])
    const observation = await runDapProbe(
      { script: 'app.py', breakpoints: [{ path: 'app.py', line: 2 }], evaluate: 'bogus_expr' },
      { runner },
    )
    expect(observation.captured).toContain('eval "bogus_expr" failed')
  })

  it('stop failing (daemon already exited) is swallowed, does not mask the real result', async () => {
    const calls: string[][] = []
    let i = 0
    const runner: DapCliRunner = async (args) => {
      calls.push(args)
      if (args[0] === 'stop') throw new Error('daemon not running')
      const stdout = [STOPPED_JSON, EVAL_JSON][i++]
      return { stdout, exitCode: 0 }
    }
    const observation = await runDapProbe(
      { script: 'app.py', breakpoints: [{ path: 'app.py', line: 2 }], evaluate: 'a + b' },
      { runner },
    )
    expect(observation.captured).toContain('a + b = 5')
  })

  it('attach/pid/backend/stopOnEntry flags are passed through to the debug command', async () => {
    const { runner, calls } = scriptedRunner([STOPPED_JSON, EVAL_JSON, 'OK\n'])
    await runDapProbe(
      {
        attach: 'localhost:5678',
        backend: 'debugpy',
        stopOnEntry: true,
        breakpoints: [{ path: 'app.py', line: 2 }],
        evaluate: 'x',
      },
      { runner },
    )
    expect(calls[0]).toEqual(
      expect.arrayContaining(['--attach', 'localhost:5678', '--backend', 'debugpy', '--stop-on-entry']),
    )
  })
})
