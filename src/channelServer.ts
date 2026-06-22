import { homedir } from 'os'
import { startChannel } from './channel'
import { resolveActiveRoom } from './roomStore'

// Pick the room bound to this working directory and join it as a channel.
// No active room here → vibegroup is off for this project; exit quietly.
const active = resolveActiveRoom(homedir(), process.cwd())
if (!active) {
  console.error('vibegroup: no room active in this directory. Add one with `vibegroup add` here.')
  process.exit(0)
}

const { url, room, token, name } = active.entry
await startChannel({ url, room, token, name })
