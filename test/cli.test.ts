import { test, expect } from 'bun:test'
import { parseArgs } from '../src/cli'

test('parseArgs reads room from positional and rest from flags/env', () => {
  const a = parseArgs(['join', 'rm_1', '--token', 'tok', '--name', 'libagent'], { VIBEGROUP_RELAY_URL: 'ws://h/ws' })
  expect(a).toEqual({ room: 'rm_1', url: 'ws://h/ws', token: 'tok', name: 'libagent', model: undefined })
})

test('parseArgs falls back to env for url/token/name/model', () => {
  const a = parseArgs(['join', 'rm_2'], {
    VIBEGROUP_RELAY_URL: 'ws://h/ws', VIBEGROUP_TOKEN: 'envtok', VIBEGROUP_NAME: 'n', VIBEGROUP_MODEL: 'haiku',
  })
  expect(a).toEqual({ room: 'rm_2', url: 'ws://h/ws', token: 'envtok', name: 'n', model: 'haiku' })
})

test('parseArgs throws when required values are missing', () => {
  expect(() => parseArgs(['join', 'rm_3'], {})).toThrow()
})
