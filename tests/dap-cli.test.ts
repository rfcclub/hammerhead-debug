import { describe, it, expect } from 'vitest'
import { classifyDapOutput, runDapCli } from '../src/dap-cli.ts'

// Real output captured from a live `dap debug`/`dap eval`/`dap stop` run against
// ~/repo/debug-skill's built binary + a debugpy-backed Python fixture, 2026-08-03 —
// not hand-written guesses at the shape.

const REAL_STOPPED_JSON = `{
  "reason": "breakpoint",
  "location": { "file": "/tmp/dap-smoke/app.py", "line": 2, "function": "add" },
  "source": [
    { "line": 1, "text": "def add(a, b):" },
    { "line": 2, "text": "    result = a + b", "current": true },
    { "line": 3, "text": "    return result" }
  ],
  "locals": [
    { "name": "a", "type": "int", "value": "2" },
    { "name": "b", "type": "int", "value": "3" }
  ],
  "stack": [
    { "frame": 0, "function": "add", "file": "/tmp/dap-smoke/app.py", "line": 2 },
    { "frame": 1, "function": "main", "file": "/tmp/dap-smoke/app.py", "line": 6 }
  ]
}`

const REAL_STOPPED_WITH_ADJUSTED_BREAKPOINT_JSON = `{
  "reason": "breakpoint",
  "location": { "file": "/tmp/dap-smoke/app.py", "line": 9, "function": "<module>" },
  "source": [{ "line": 9, "text": "main()", "current": true }],
  "stack": [{ "frame": 0, "function": "<module>", "file": "/tmp/dap-smoke/app.py", "line": 9 }],
  "warnings": ["breakpoint at app.py:999 was adjusted to line 9"]
}`

const REAL_EVAL_JSON = `{ "eval_result": { "value": "5", "type": "int" } }`

const REAL_TERMINATED_TEXT = `Program terminated
Exit code: 1
Output:
  FileNotFoundError: [Errno 2] No such file or directory: 'does-not-exist.py'

Warnings:
  ⚠ breakpoint at line 1 not verified: Breakpoint in file that does not exist.`

const REAL_STOP_OK_TEXT = 'OK\n'

describe('classifyDapOutput', () => {
  it('classifies a real stopped-at-breakpoint response as stopped', () => {
    const result = classifyDapOutput(REAL_STOPPED_JSON)
    expect(result.kind).toBe('stopped')
    if (result.kind === 'stopped') {
      expect(result.data.reason).toBe('breakpoint')
      expect(result.data.location).toEqual({ file: '/tmp/dap-smoke/app.py', line: 2, function: 'add' })
      expect(result.data.locals).toHaveLength(2)
    }
  })

  it('classifies a stopped response with adjusted-breakpoint warnings', () => {
    const result = classifyDapOutput(REAL_STOPPED_WITH_ADJUSTED_BREAKPOINT_JSON)
    expect(result.kind).toBe('stopped')
    if (result.kind === 'stopped') {
      expect(result.data.warnings).toContain('breakpoint at app.py:999 was adjusted to line 9')
    }
  })

  it('classifies an eval response as ok with eval_result', () => {
    const result = classifyDapOutput(REAL_EVAL_JSON)
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      expect((result.data as { eval_result: { value: string } }).eval_result.value).toBe('5')
    }
  })

  it('classifies "Program terminated" plain text (not JSON, despite --json) as terminated', () => {
    const result = classifyDapOutput(REAL_TERMINATED_TEXT)
    expect(result.kind).toBe('terminated')
    if (result.kind === 'terminated') {
      expect(result.exitCode).toBe(1)
    }
  })

  it('classifies "Error: ..." plain text as error', () => {
    const result = classifyDapOutput('Error: starting debug adapter: macOS developer mode is disabled')
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.message).toContain('macOS developer mode')
    }
  })

  it('classifies bare "OK" (dap stop\'s real output, even with --json) as ok without throwing', () => {
    const result = classifyDapOutput(REAL_STOP_OK_TEXT)
    expect(result.kind).toBe('ok')
  })
})

describe('runDapCli', () => {
  it('appends --json to every invocation and delegates to the injected runner', async () => {
    let capturedArgs: string[] = []
    const result = await runDapCli(async (args) => {
      capturedArgs = args
      return { stdout: REAL_EVAL_JSON, exitCode: 0 }
    }, ['eval', 'x + y'])

    expect(capturedArgs).toEqual(['eval', 'x + y', '--json'])
    expect(result.kind).toBe('ok')
  })
})
