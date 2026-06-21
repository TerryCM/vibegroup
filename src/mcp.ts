import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createToolServer, type ToolDef } from './toolServer'
import type { AgentSession } from './agentSession'

export function vibegroupTools(session: AgentSession): ToolDef[] {
  return [
    {
      name: 'vibegroup_peers',
      description: 'List the agents currently in your vibegroup room.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => JSON.stringify(await session.peers(), null, 2),
    },
    {
      name: 'vibegroup_ask',
      description: 'Ask a peer agent a question. Returns a qid immediately; collect the answer later with vibegroup_inbox.',
      inputSchema: {
        type: 'object',
        properties: { peer: { type: 'string', description: 'target peerId' }, question: { type: 'string' } },
        required: ['peer', 'question'],
      },
      handler: async (a) => session.ask(String(a.peer), String(a.question)),
    },
    {
      name: 'vibegroup_inbox',
      description: 'Retrieve answers that have arrived for your questions since the last check.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => JSON.stringify(session.inbox(), null, 2),
    },
    {
      name: 'vibegroup_status',
      description: "Show this agent's vibegroup connection status.",
      inputSchema: { type: 'object', properties: {} },
      handler: async () => JSON.stringify({ peerId: session.peerId, connected: Boolean(session.peerId) }),
    },
    {
      name: 'vibegroup_leave',
      description: 'Leave the vibegroup room.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => { session.leave(); return 'left' },
    },
  ]
}

export async function startMcpServer(session: AgentSession): Promise<void> {
  const server = createToolServer(
    { name: 'vibegroup', version: '0.0.1' },
    vibegroupTools(session),
    { capabilities: { tools: {} } },
  )
  await server.connect(new StdioServerTransport())
}
