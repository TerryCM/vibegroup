import { test, expect } from 'bun:test'

test('plugin.json is valid and names the plugin', async () => {
  const p = await Bun.file('.claude-plugin/plugin.json').json()
  expect(p.name).toBe('vibegroup')
  expect(typeof p.version).toBe('string')
})

test('.mcp.json registers the vibegroup server via bun', async () => {
  const m = await Bun.file('.mcp.json').json()
  expect(m.mcpServers.vibegroup).toBeDefined()
  expect(m.mcpServers.vibegroup.command).toBe('bun')
  expect(m.mcpServers.vibegroup.args.join(' ')).toContain('src/channelServer.ts')
})

test('the slash command and hook files exist', async () => {
  expect(await Bun.file('commands/vibegroup.md').exists()).toBe(true)
  expect(await Bun.file('hooks/hooks.json').exists()).toBe(true)
})
