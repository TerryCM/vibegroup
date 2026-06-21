import { test, expect } from 'bun:test'
import { questionPush, answerPush, createChannelTools, type RelayLike } from '../src/channel'
import type { PeerSummary } from '../src/relayClient'

test('questionPush wraps the question with identifier-safe meta', () => {
  const p = questionPush({ from: 'p_abc', qid: 'q_123', question: 'what branch?' })
  expect(p.content).toBe('what branch?')
  expect(p.meta).toEqual({ kind: 'question', from: 'p_abc', qid: 'q_123' })
})

test('answerPush carries the answer and qid', () => {
  const p = answerPush({ from: 'p_xyz', qid: 'q_123', answer: 'on feat/x' })
  expect(p.content).toBe('on feat/x')
  expect(p.meta).toEqual({ kind: 'answer', from: 'p_xyz', qid: 'q_123' })
})

function fakeRelay() {
  const calls: { answered?: { to: string; qid: string; text: string }; asked?: { peer: string; q: string } } = {}
  const relay: RelayLike = {
    peerId: 'p_self',
    peers: async (): Promise<PeerSummary[]> => [{ peerId: 'p_bob', name: 'bob', state: 'available', lastSeen: 0 }],
    ask: async (peer, q) => { calls.asked = { peer, q }; return 'q_new' },
    answer: async (to, qid, text) => { calls.answered = { to, qid, text } },
  }
  return { relay, calls }
}

test('vibegroup_ask forwards to the relay and returns a qid', async () => {
  const { relay, calls } = fakeRelay()
  const tools = createChannelTools(relay, new Map())
  const ask = tools.find((t) => t.name === 'vibegroup_ask')!
  expect(await ask.handler({ peer: 'p_bob', question: 'status?' })).toBe('q_new')
  expect(calls.asked).toEqual({ peer: 'p_bob', q: 'status?' })
})

test('vibegroup_reply redacts secrets and routes the answer to the original asker', async () => {
  const { relay, calls } = fakeRelay()
  const pending = new Map([['q_123', 'p_bob']])   // q_123 was asked by p_bob
  const tools = createChannelTools(relay, pending)
  const reply = tools.find((t) => t.name === 'vibegroup_reply')!

  await reply.handler({ qid: 'q_123', text: 'on feat/x; key AKIAIOSFODNN7EXAMPLE' })

  expect(calls.answered).toEqual({ to: 'p_bob', qid: 'q_123', text: 'on feat/x; key [REDACTED]' })
  expect(pending.has('q_123')).toBe(false)   // consumed
})

test('exposes exactly the three channel tools', () => {
  const { relay } = fakeRelay()
  const names = createChannelTools(relay, new Map()).map((t) => t.name).sort()
  expect(names).toEqual(['vibegroup_ask', 'vibegroup_peers', 'vibegroup_reply'])
})
