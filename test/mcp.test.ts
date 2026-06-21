import { test, expect, afterEach } from 'bun:test'
import { startRelay, type RelayHandle } from '@vibegroup/relay'
import { AgentSession } from '../src/agentSession'
import { vibegroupTools } from '../src/mcp'
import type { AnswerEngine } from '../src/responder'

let relay: RelayHandle | undefined
afterEach(() => { relay?.stop(); relay = undefined })

async function setup() {
  relay = startRelay({ port: 0, secret: 's' })
  const { room, token } = await (await fetch(`http://localhost:${relay.port}/rooms`, { method: 'POST' })).json() as { room: string; token: string }
  return { url: `ws://localhost:${relay.port}/ws`, room, token }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

test('exposes the expected tool names with schemas', async () => {
  const cfg = await setup()
  const s = new AgentSession({ ...cfg, name: 'alice' })
  const names = vibegroupTools(s).map((t) => t.name).sort()
  expect(names).toEqual(['vibegroup_ask', 'vibegroup_inbox', 'vibegroup_leave', 'vibegroup_peers', 'vibegroup_status'])
  for (const t of vibegroupTools(s)) expect(t.inputSchema).toBeDefined()
})

test('the ask + inbox tools complete a round trip', async () => {
  const cfg = await setup()
  const engine: AnswerEngine = { answer: async (q) => `re: ${q}` }
  const bob = new AgentSession({ ...cfg, name: 'bob', engine, cwd: '/proj' })
  const alice = new AgentSession({ ...cfg, name: 'alice' })
  await bob.join(); await alice.join()

  const tools = vibegroupTools(alice)
  const ask = tools.find((t) => t.name === 'vibegroup_ask')!
  const inbox = tools.find((t) => t.name === 'vibegroup_inbox')!

  const qid = (await ask.handler({ peer: bob.peerId!, question: 'status?' })).trim()
  let out = ''
  for (let i = 0; i < 100 && !out.includes('re: status?'); i++) { await sleep(20); out += await inbox.handler({}) }
  expect(out).toContain('re: status?')
  expect(out).toContain(qid)
  alice.leave(); bob.leave()
})
