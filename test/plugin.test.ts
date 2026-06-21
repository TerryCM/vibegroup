import { test, expect } from 'bun:test'

test('plugin.json is valid and names the plugin', async () => {
  const p = await Bun.file('.claude-plugin/plugin.json').json()
  expect(p.name).toBe('vibegroup')
  expect(typeof p.version).toBe('string')
})

test('.mcp.json runs the prebuilt channel bundle via bun', async () => {
  const m = await Bun.file('.mcp.json').json()
  expect(m.mcpServers.vibegroup).toBeDefined()
  expect(m.mcpServers.vibegroup.command).toBe('bun')
  expect(m.mcpServers.vibegroup.args.join(' ')).toContain('dist/channel.js')
})

test('the channel bundle is committed so the plugin runs without an install step', async () => {
  expect(await Bun.file('dist/channel.js').exists()).toBe(true)
})

test('the slash commands and hook files exist', async () => {
  expect(await Bun.file('commands/vibegroup.md').exists()).toBe(true)
  expect(await Bun.file('commands/setup.md').exists()).toBe(true)
  expect(await Bun.file('hooks/hooks.json').exists()).toBe(true)
})
