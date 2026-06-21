import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { AgentSession } from './agentSession'

export interface ToolDef {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (args: Record<string, unknown>) => Promise<string>
}

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
  const tools = vibegroupTools(session)
  const server = new Server({ name: 'vibegroup', version: '0.0.1' }, { capabilities: { tools: {} } })
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
  }))
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = tools.find((t) => t.name === req.params.name)
    if (!tool) throw new Error(`unknown tool: ${req.params.name}`)
    const text = await tool.handler((req.params.arguments ?? {}) as Record<string, unknown>)
    return { content: [{ type: 'text', text }] }
  })
  await server.connect(new StdioServerTransport())
}
