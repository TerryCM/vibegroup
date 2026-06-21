import { test, expect } from 'bun:test'
import { redactSecrets } from '../src/redact'

test('redacts provider API keys', () => {
  expect(redactSecrets('key sk-ant-api03-AbCdEfGhIjKlMnOpQrStUv')).toBe('key [REDACTED]')
  expect(redactSecrets('aws AKIAIOSFODNN7EXAMPLE here')).toBe('aws [REDACTED] here')
  expect(redactSecrets('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')).toBe('[REDACTED]')
})

test('redacts a private key block', () => {
  const pk = '-----BEGIN OPENSSH PRIVATE KEY-----\nabcDEF123\n-----END OPENSSH PRIVATE KEY-----'
  expect(redactSecrets(`here: ${pk}`)).toBe('here: [REDACTED PRIVATE KEY]')
})

test('redacts the value of secret-named assignments, keeping the key', () => {
  expect(redactSecrets('DB_PASSWORD=hunter2supersecret')).toBe('DB_PASSWORD=[REDACTED]')
  expect(redactSecrets('API_KEY: abc123def456')).toBe('API_KEY: [REDACTED]')
})

test('leaves ordinary answer text intact', () => {
  const s = 'The branch is feat/importer and the importer is done; tests pass.'
  expect(redactSecrets(s)).toBe(s)
})

test('caps length with a truncation marker', () => {
  const out = redactSecrets('x'.repeat(5000), 100)
  expect(out.length).toBeLessThanOrEqual(120)
  expect(out.endsWith('…[truncated]')).toBe(true)
})
