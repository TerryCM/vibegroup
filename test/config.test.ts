import { test, expect } from 'bun:test'
import {
  resolveConfig,
  mergeManagedSettings,
  managedSettingsPath,
  configPath,
  DEFAULT_RELAY_WS,
} from '../src/config'

test('resolveConfig: env values win over the config file', () => {
  const cfg = resolveConfig(
    { VIBEGROUP_ROOM: 'rm_env', VIBEGROUP_TOKEN: 't_env', VIBEGROUP_NAME: 'alice' },
    { room: 'rm_file', token: 't_file', name: 'bob', url: 'wss://file/ws' },
  )
  expect(cfg).toEqual({ url: 'wss://file/ws', room: 'rm_env', token: 't_env', name: 'alice' })
})

test('resolveConfig: falls back to the config file, then defaults', () => {
  const cfg = resolveConfig({}, { room: 'rm_file', token: 't_file' })
  expect(cfg).toEqual({ url: DEFAULT_RELAY_WS, room: 'rm_file', token: 't_file', name: 'vibegroup-agent' })
})

test('resolveConfig: returns null when room/token are missing', () => {
  expect(resolveConfig({}, null)).toBeNull()
  expect(resolveConfig({ VIBEGROUP_ROOM: 'rm' }, null)).toBeNull()
})

test('mergeManagedSettings: adds the vibegroup entry and enables channels on empty settings', () => {
  const merged = mergeManagedSettings(null)
  expect(merged.channelsEnabled).toBe(true)
  expect(merged.allowedChannelPlugins).toEqual([{ marketplace: 'vibegroup', plugin: 'vibegroup' }])
})

test('mergeManagedSettings: preserves existing keys and is idempotent', () => {
  const existing = {
    someOtherPolicy: 'keep-me',
    allowedChannelPlugins: [{ marketplace: 'fakechat', plugin: 'fakechat' }],
  }
  const once = mergeManagedSettings(existing)
  expect(once.someOtherPolicy).toBe('keep-me')
  expect(once.allowedChannelPlugins).toEqual([
    { marketplace: 'fakechat', plugin: 'fakechat' },
    { marketplace: 'vibegroup', plugin: 'vibegroup' },
  ])
  // running it again does not duplicate the entry
  expect(mergeManagedSettings(once)).toEqual(once)
})

test('managedSettingsPath: per-platform locations', () => {
  expect(managedSettingsPath('darwin')).toBe('/Library/Application Support/ClaudeCode/managed-settings.json')
  expect(managedSettingsPath('linux')).toBe('/etc/claude-code/managed-settings.json')
})

test('configPath: under ~/.claude/vibegroup', () => {
  expect(configPath('/home/x')).toBe('/home/x/.claude/vibegroup/config.json')
})
