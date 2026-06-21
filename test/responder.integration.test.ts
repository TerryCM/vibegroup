import { test, expect, afterEach } from 'bun:test'
import { startRelay, type RelayHandle } from '@vibegroup/relay'
import { RelayClient } from '../src/relayClient'
import { createResponder, attachResponder, type AnswerEngine } from '../src/responder'

let relay: RelayHandle | undefined
afterEach(() => { relay?.stop(); relay = undefined })

async function setup() {
  relay = startRelay({ port: 0, secret: 's' })
  const { room, token } = await (await fetch(`http://localhost:${relay.port}/rooms`, { method: 'POST' })).json() as { room: string; token: string }
  return { url: `ws://localhost:${relay.port}/ws`, room, token }
}

test('an attached responder answers a peer question, redacted', async () => {
  const { url, room, token } = await setup()
  const alice = new RelayClient({ url, room, token, name: 'alice' })
  const bob = new RelayClient({ url, room, token, name: 'bob' })
  await alice.connect()
  await bob.connect()

  const engine: AnswerEngine = { answer: async (q) => `re "${q}": on feat/importer; token AKIAIOSFODNN7EXAMPLE` }
  attachResponder(bob, createResponder({ engine, cwd: '/proj' }))

  const gotAnswer = new Promise<{ answer: string }>((r) => alice.onAnswer(r))
  await alice.ask(bob.peerId!, 'what are you working on?')
  const a = await gotAnswer

  expect(a.answer).toBe('re "what are you working on?": on feat/importer; token [REDACTED]')
  alice.close(); bob.close()
})
