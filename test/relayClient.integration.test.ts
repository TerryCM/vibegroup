import { test, expect, afterEach } from 'bun:test'
import { startRelay, type RelayHandle } from '@vibegroup/relay'
import { RelayClient } from '../src/relayClient'

let relay: RelayHandle | undefined
afterEach(() => { relay?.stop(); relay = undefined })

async function setup() {
  relay = startRelay({ port: 0, secret: 's' })
  const { room, token } = await (await fetch(`http://localhost:${relay.port}/rooms`, { method: 'POST' })).json() as { room: string; token: string }
  return { url: `ws://localhost:${relay.port}/ws`, room, token }
}

test('connect joins the room and assigns a peerId', async () => {
  const { url, room, token } = await setup()
  const c = new RelayClient({ url, room, token, name: 'alice' })
  await c.connect()
  expect(c.peerId).toMatch(/^p_/)
  c.close()
})

test('ask delivers an encrypted question the peer decrypts', async () => {
  const { url, room, token } = await setup()
  const alice = new RelayClient({ url, room, token, name: 'alice' })
  const bob = new RelayClient({ url, room, token, name: 'bob' })
  await alice.connect()
  await bob.connect()

  const got = new Promise<{ from: string; qid: string; question: string }>((r) => bob.onQuestion(r))
  const qid = await alice.ask(bob.peerId!, 'what branch are you on?')
  const q = await got

  expect(q.question).toBe('what branch are you on?')
  expect(q.qid).toBe(qid)
  expect(q.from).toBe(alice.peerId)
  alice.close(); bob.close()
})

test('full encrypted ask -> answer round trip', async () => {
  const { url, room, token } = await setup()
  const alice = new RelayClient({ url, room, token, name: 'alice' })
  const bob = new RelayClient({ url, room, token, name: 'bob' })
  await alice.connect()
  await bob.connect()

  bob.onQuestion(async (q) => { await bob.answer(q.from, q.qid, `answering: ${q.question}`) })
  const gotAnswer = new Promise<{ from: string; qid: string; answer: string }>((r) => alice.onAnswer(r))

  const qid = await alice.ask(bob.peerId!, 'did you finish the importer?')
  const a = await gotAnswer

  expect(a.qid).toBe(qid)
  expect(a.from).toBe(bob.peerId)
  expect(a.answer).toBe('answering: did you finish the importer?')
  alice.close(); bob.close()
})

test('peers lists the room members', async () => {
  const { url, room, token } = await setup()
  const alice = new RelayClient({ url, room, token, name: 'alice' })
  const bob = new RelayClient({ url, room, token, name: 'bob' })
  await alice.connect()
  await bob.connect()

  const names = (await alice.peers()).map((p) => p.name).sort()
  expect(names).toEqual(['alice', 'bob'])
  alice.close(); bob.close()
})
