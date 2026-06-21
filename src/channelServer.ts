import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { startChannel } from './channel'
import { resolveConfig, configPath, type VibegroupConfig } from './config'

function readConfigFile(): Partial<VibegroupConfig> | null {
  const path = configPath(homedir())
  try {
    if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    /* unreadable/invalid config — treat as absent */
  }
  return null
}

const config = resolveConfig(process.env, readConfigFile())
if (!config) {
  console.error('vibegroup: not configured yet. Run /vibegroup:setup to join a room.')
  process.exit(0)
}

await startChannel(config)
