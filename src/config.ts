import { join } from 'path'

export const DEFAULT_RELAY_WS = 'wss://relay.vibegroup.sh/ws'
export const DEFAULT_RELAY_HTTP = 'https://relay.vibegroup.sh'

export interface VibegroupConfig {
  url: string
  room: string
  token: string
  name: string
}

export interface AllowedChannelPlugin {
  marketplace: string
  plugin: string
}

const VIBEGROUP_ENTRY: AllowedChannelPlugin = { marketplace: 'vibegroup', plugin: 'vibegroup' }

export function configPath(home: string): string {
  return join(home, '.claude', 'vibegroup', 'config.json')
}

export function managedSettingsPath(plat: NodeJS.Platform): string {
  if (plat === 'darwin') return '/Library/Application Support/ClaudeCode/managed-settings.json'
  if (plat === 'win32') return 'C:\\ProgramData\\ClaudeCode\\managed-settings.json'
  return '/etc/claude-code/managed-settings.json'
}

// env vars take precedence over the saved config file, then fall back to defaults.
export function resolveConfig(
  env: Record<string, string | undefined>,
  file: Partial<VibegroupConfig> | null,
): VibegroupConfig | null {
  const room = env.VIBEGROUP_ROOM ?? file?.room
  const token = env.VIBEGROUP_TOKEN ?? file?.token
  if (!room || !token) return null
  return {
    url: env.VIBEGROUP_RELAY_URL ?? file?.url ?? DEFAULT_RELAY_WS,
    room,
    token,
    name: env.VIBEGROUP_NAME ?? file?.name ?? 'vibegroup-agent',
  }
}

// Idempotently enable channels and allowlist vibegroup, preserving any other managed-settings keys.
export function mergeManagedSettings(existing: Record<string, unknown> | null): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(existing ?? {}) }
  next.channelsEnabled = true
  const current = Array.isArray(next.allowedChannelPlugins)
    ? (next.allowedChannelPlugins as AllowedChannelPlugin[])
    : []
  const has = current.some((e) => e?.marketplace === 'vibegroup' && e?.plugin === 'vibegroup')
  next.allowedChannelPlugins = has ? current : [...current, VIBEGROUP_ENTRY]
  return next
}
