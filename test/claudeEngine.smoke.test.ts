import { test, expect } from 'bun:test'
import { claudeAnswerEngine } from '../src/responder'

// Live test: requires Claude Code installed + authenticated. Opt in with VIBEGROUP_E2E_CLAUDE=1.
const live = process.env.VIBEGROUP_E2E_CLAUDE === '1' ? test : test.skip

live('claude engine answers a read-only question about this repo', async () => {
  const engine = claudeAnswerEngine({ cwd: process.cwd(), timeoutMs: 120_000 })
  const answer = await engine.answer('What is the current git branch? Answer in one line.', { cwd: process.cwd() })
  expect(answer.length).toBeGreaterThan(0)
}, 130_000)
