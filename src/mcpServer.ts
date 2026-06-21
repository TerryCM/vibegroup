import { AgentSession } from './agentSession'
import { startMcpServer } from './mcp'
import { claudeAnswerEngine } from './responder'

const env = process.env
const url = env.VIBEGROUP_RELAY_URL
const room = env.VIBEGROUP_ROOM
const token = env.VIBEGROUP_TOKEN
if (!url || !room || !token) {
  console.error('vibegroup: set VIBEGROUP_RELAY_URL, VIBEGROUP_ROOM, VIBEGROUP_TOKEN')
  process.exit(1)
}
const session = new AgentSession({
  url, room, token, name: env.VIBEGROUP_NAME ?? 'vibegroup-agent',
  engine: claudeAnswerEngine({ cwd: process.cwd(), model: env.VIBEGROUP_MODEL }), cwd: process.cwd(),
})
await session.join()
await startMcpServer(session)
