import { test, expect } from 'bun:test'
import { newPeerId, newQid, newMsgId } from '../src/ids'

test('newPeerId is prefixed and unique', () => {
  const a = newPeerId()
  const b = newPeerId()
  expect(a).toMatch(/^p_[0-9a-f]{16}$/)
  expect(a).not.toBe(b)
})

test('newQid and newMsgId carry their prefixes', () => {
  expect(newQid()).toMatch(/^q_[0-9a-f]{16}$/)
  expect(newMsgId()).toMatch(/^m_[0-9a-f]{16}$/)
})
