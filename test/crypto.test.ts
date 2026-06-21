import { test, expect } from 'bun:test'
import { deriveRoomKey, seal, open } from '../src/crypto'

test('seal then open round-trips with the room key', () => {
  const key = deriveRoomKey('tok_abc', 'rm_1')
  const body = seal(key, 'what branch are you on?')
  expect(open(key, body)).toBe('what branch are you on?')
})

test('a different room token derives a key that cannot open the body', () => {
  const body = seal(deriveRoomKey('tok_abc', 'rm_1'), 'secret answer')
  expect(() => open(deriveRoomKey('tok_DIFFERENT', 'rm_1'), body)).toThrow()
})

test('tampered ciphertext fails authentication', () => {
  const key = deriveRoomKey('tok_abc', 'rm_1')
  const body = seal(key, 'hello')
  const tampered = { ...body, ciphertext: Buffer.from('00'.repeat(40), 'hex').toString('base64') }
  expect(() => open(key, tampered)).toThrow()
})

test('each seal uses a fresh nonce', () => {
  const key = deriveRoomKey('tok_abc', 'rm_1')
  const a = seal(key, 'same')
  const b = seal(key, 'same')
  expect(a.nonce).not.toBe(b.nonce)
  expect(a.ciphertext).not.toBe(b.ciphertext)
})
