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
