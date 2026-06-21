import { test, expect } from 'bun:test'
import { parseEnvelope, serialize, PROTOCOL_VERSION, type Envelope } from '../src/envelope'

const base: Envelope = {
  v: PROTOCOL_VERSION,
  kind: 'question',
  id: 'm_0000000000000000',
  ts: 1000,
  to: 'p_aaaa000000000000',
  qid: 'q_bbbb000000000000',
  seq: 1,
  body: { ciphertext: 'deadbeef', nonce: 'cafef00d' },
}

test('round-trips a valid envelope', () => {
  expect(parseEnvelope(serialize(base))).toEqual(base)
})

test('rejects an envelope with the wrong version', () => {
  const bad = serialize({ ...base, v: 2 as unknown as 1 })
  expect(() => parseEnvelope(bad)).toThrow()
})

test('rejects an unknown kind', () => {
  const bad = JSON.stringify({ ...base, kind: 'nope' })
  expect(() => parseEnvelope(bad)).toThrow()
})

test('rejects non-JSON', () => {
  expect(() => parseEnvelope('{not json')).toThrow()
})
