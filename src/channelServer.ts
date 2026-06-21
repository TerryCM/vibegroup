import { startChannel } from './channel'

const env = process.env
const url = env.VIBEGROUP_RELAY_URL
const room = env.VIBEGROUP_ROOM
const token = env.VIBEGROUP_TOKEN
if (!url || !room || !token) {
  console.error('vibegroup: set VIBEGROUP_RELAY_URL, VIBEGROUP_ROOM, VIBEGROUP_TOKEN')
  process.exit(1)
}

await startChannel({ url, room, token, name: env.VIBEGROUP_NAME ?? 'vibegroup-agent' })
