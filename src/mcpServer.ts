import { homedir } from 'os'
import { AgentSession } from './agentSession'
import { startMcpServer } from './mcp'
import { claudeAnswerEngine } from './responder'
import { resolveActiveRoom } from './roomStore'

// Resolve the room bound to this directory; the responder answers from that
// room's project dir, so a session only speaks for the project it was started in.
const active = resolveActiveRoom(homedir(), process.cwd())
if (!active) {
  console.error('vibegroup: no room active in this directory. Add one with `vibegroup add` here.')
  process.exit(0)
}

const { url, room, token, name, dir } = active.entry
const session = new AgentSession({
  url, room, token, name,
  engine: claudeAnswerEngine({ cwd: dir, model: process.env.VIBEGROUP_MODEL }),
  cwd: dir,
})
await session.join()
await startMcpServer(session)
