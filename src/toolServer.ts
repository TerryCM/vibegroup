import { Server, type ServerOptions } from '@modelcontextprotocol/sdk/server/index.js'
import { ListToolsRequestSchema, CallToolRequestSchema, type Implementation } from '@modelcontextprotocol/sdk/types.js'

// A single tool the MCP server exposes: its public shape plus the handler that runs it.
export interface ToolDef {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (args: Record<string, unknown>) => Promise<string>
}

// Build an MCP Server that advertises `tools` and dispatches calls to their handlers.
// Both the agent server and the channel server share this wiring — they differ only
// in the tool set and capabilities, so keep the boilerplate in one place.
export function createToolServer(info: Implementation, tools: ToolDef[], options: ServerOptions): Server {
  const server = new Server(info, options)
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
  }))
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = tools.find((t) => t.name === req.params.name)
    if (!tool) throw new Error(`unknown tool: ${req.params.name}`)
    const text = await tool.handler((req.params.arguments ?? {}) as Record<string, unknown>)
    return { content: [{ type: 'text', text }] }
  })
  return server
}
