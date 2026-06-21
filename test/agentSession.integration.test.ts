import { test, expect, afterEach } from 'bun:test'
import { startRelay, type RelayHandle } from '@vibegroup/relay'
import { AgentSession } from '../src/agentSession'
import type { AnswerEngine } from '../src/responder'

let relay: RelayHandle | undefined
afterEach(() => { relay?.stop(); relay = undefined })

async function setup() {
  relay = startRelay({ port: 0, secret: 's' })
  const { room, token } = await (await fetch(`http://localhost:${relay.port}/rooms`, { method: 'POST' })).json() as { room: string; token: string }
  return { url: `ws://localhost:${relay.port}/ws`, room, token }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

test('an asker session receives a responder session answer in its inbox', async () => {
  const cfg = await setup()
  const engine: AnswerEngine = { answer: async (q) => `re: ${q}` }
  const bob = new AgentSession({ ...cfg, name: 'bob', engine, cwd: '/proj' })
  const alice = new AgentSession({ ...cfg, name: 'alice' })
  await bob.join()
  const { peerId: alicePeer } = await alice.join()
  expect(alicePeer).toMatch(/^p_/)

  const qid = await alice.ask(bob.peerId!, 'status?')
  let answers = alice.inbox()
  for (let i = 0; i < 100 && answers.length === 0; i++) { await sleep(20); answers = alice.inbox() }

  expect(answers).toHaveLength(1)
  expect(answers[0].qid).toBe(qid)
  expect(answers[0].answer).toBe('re: status?')
  alice.leave(); bob.leave()
})

test('peers lists members', async () => {
  const cfg = await setup()
  const a = new AgentSession({ ...cfg, name: 'alice' })
  const b = new AgentSession({ ...cfg, name: 'bob' })
  await a.join(); await b.join()
  expect((await a.peers()).map((p) => p.name).sort()).toEqual(['alice', 'bob'])
  a.leave(); b.leave()
})
