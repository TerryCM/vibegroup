import { test, expect } from 'bun:test'
import { createResponder, type AnswerEngine } from '../src/responder'

const engineReturning = (s: string): AnswerEngine => ({ answer: async () => s })
const engineThrowing = (): AnswerEngine => ({ answer: async () => { throw new Error('boom') } })

test('handle returns the engine answer, redacted', async () => {
  const r = createResponder({ engine: engineReturning('on feat/x; key AKIAIOSFODNN7EXAMPLE'), cwd: '/tmp' })
  expect(await r.handle('status?')).toBe('on feat/x; key [REDACTED]')
})

test('handle degrades safely when the engine throws', async () => {
  const r = createResponder({ engine: engineThrowing(), cwd: '/tmp' })
  expect(await r.handle('status?')).toBe('vibegroup responder could not answer that from available context.')
})

test('handle caps the answer length', async () => {
  const r = createResponder({ engine: engineReturning('y'.repeat(5000)), cwd: '/tmp', maxAnswerChars: 50 })
  const out = await r.handle('status?')
  expect(out.endsWith('…[truncated]')).toBe(true)
})

test('handle passes the question and cwd to the engine', async () => {
  let seen: { q: string; cwd: string } | undefined
  const engine: AnswerEngine = { answer: async (q, o) => { seen = { q, cwd: o.cwd }; return 'ok' } }
  const r = createResponder({ engine, cwd: '/work/proj' })
  await r.handle('what branch?')
  expect(seen).toEqual({ q: 'what branch?', cwd: '/work/proj' })
})
