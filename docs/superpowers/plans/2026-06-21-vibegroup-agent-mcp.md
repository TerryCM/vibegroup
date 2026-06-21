# vibegroup Agent — MCP Surface + Daemon + Plugin (M2c)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Expose the agent to a real Claude Code session — an `AgentSession` (join/peers/ask/inbox/leave + an attached responder), MCP tools over stdio, a standalone `vibegroup` daemon, and a Claude Code plugin (mcp config, `/vibegroup` slash command, SessionStart context hook).

**Architecture:** `AgentSession` wraps `RelayClient`, accumulates inbound answers into an inbox, and (when given an engine) attaches the read-only responder — so one process both asks and answers. `mcp.ts` exposes the session as MCP tools (testable tool defs + a thin stdio wrapper). `cli.ts` runs the session as a standalone answering daemon. The plugin wires the MCP server + commands + hook into Claude Code.

**Tech Stack:** Bun + TypeScript, `@modelcontextprotocol/sdk`, `bun:test`. Builds on M2a/M2b.

## Global Constraints

- Bun >= 1.1, TypeScript, `bun:test`. (Every task.)
- One process does both roles: the MCP server holds the `RelayClient` + responder while the session is open; the standalone daemon answers when the session is closed.
- Asker flow is non-blocking: `vibegroup_ask` returns a `qid`; answers are retrieved via `vibegroup_inbox`.
- Config via env: `VIBEGROUP_RELAY_URL`, `VIBEGROUP_ROOM`, `VIBEGROUP_TOKEN`, `VIBEGROUP_NAME`, `VIBEGROUP_MODEL`.
- Lives in the `vibegroup` repo; branch `feat/agent-mcp` (Task 1).

---

## File Structure

```
vibegroup/
  src/agentSession.ts          # AgentSession (RelayClient + inbox + responder)
  src/mcp.ts                   # vibegroupTools(session) + startMcpServer(session)
  src/cli.ts                   # parseArgs + the standalone daemon main
  test/agentSession.integration.test.ts
  test/mcp.test.ts
  test/cli.test.ts
  .claude-plugin/plugin.json   # plugin manifest
  .mcp.json                    # MCP server registration
  commands/vibegroup.md        # /vibegroup slash command
  hooks/session-start.sh       # SessionStart context hook
  hooks/hooks.json
```

---

## Task 1: AgentSession

**Files:** Create `src/agentSession.ts`; Test `test/agentSession.integration.test.ts`

**Interfaces:**
- Consumes: `RelayClient`, `PeerSummary` from `./relayClient`; `createResponder`, `attachResponder`, `AnswerEngine` from `./responder`.
- Produces: `interface AgentSessionOptions { url: string; room: string; token: string; name: string; engine?: AnswerEngine; cwd?: string }`; `interface InboxAnswer { from: string; qid: string; answer: string }`; `class AgentSession` with `join(): Promise<{ peerId: string }>`, `peerId: string | undefined`, `peers(): Promise<PeerSummary[]>`, `ask(peer, question): Promise<string>`, `inbox(): InboxAnswer[]` (drains), `leave(): void`.

- [ ] **Step 1: Branch + failing test**

```bash
cd /Volumes/terry-hd/side-projects/vibegroup
git checkout -b feat/agent-mcp
```

`test/agentSession.integration.test.ts`:

```ts
import { test, expect, afterEach } from 'bun:test'
import { startRelay, type RelayHandle } from '@vibegroup/relay'
import { AgentSession } from '../src/agentSession'
import type { AnswerEngine } from '../src/responder'

let relay: RelayHandle | undefined
afterEach(() => { relay?.stop(); relay = undefined })

async function setup() {
  relay = startRelay({ port: 0, secret: 's' })
  const { room, token } = await (await fetch(`http://localhost:${relay.port}/rooms`, { method: 'POST' })).json() as { room: string; token: string }
  return { url: `ws://localhost:${relay.port}/ws`, room, token }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

test('an asker session receives a responder session answer in its inbox', async () => {
  const cfg = await setup()
  const engine: AnswerEngine = { answer: async (q) => `re: ${q}` }
  const bob = new AgentSession({ ...cfg, name: 'bob', engine, cwd: '/proj' })
  const alice = new AgentSession({ ...cfg, name: 'alice' })
  await bob.join()
  const { peerId: alicePeer } = await alice.join()
  expect(alicePeer).toMatch(/^p_/)

  const qid = await alice.ask(bob.peerId!, 'status?')
  let answers = alice.inbox()
  for (let i = 0; i < 100 && answers.length === 0; i++) { await sleep(20); answers = alice.inbox() }

  expect(answers).toHaveLength(1)
  expect(answers[0].qid).toBe(qid)
  expect(answers[0].answer).toBe('re: status?')
  alice.leave(); bob.leave()
})

test('peers lists members', async () => {
  const cfg = await setup()
  const a = new AgentSession({ ...cfg, name: 'alice' })
  const b = new AgentSession({ ...cfg, name: 'bob' })
  await a.join(); await b.join()
  expect((await a.peers()).map((p) => p.name).sort()).toEqual(['alice', 'bob'])
  a.leave(); b.leave()
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `bun test test/agentSession.integration.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

`src/agentSession.ts`:

```ts
import { RelayClient, type PeerSummary } from './relayClient'
import { createResponder, attachResponder, type AnswerEngine } from './responder'

export interface AgentSessionOptions {
  url: string; room: string; token: string; name: string
  engine?: AnswerEngine; cwd?: string
}
export interface InboxAnswer { from: string; qid: string; answer: string }

export class AgentSession {
  private client: RelayClient
  private buf: InboxAnswer[] = []

  constructor(opts: AgentSessionOptions) {
    this.client = new RelayClient(opts)
    this.client.onAnswer((a) => this.buf.push({ from: a.from, qid: a.qid, answer: a.answer }))
    if (opts.engine) {
      attachResponder(this.client, createResponder({ engine: opts.engine, cwd: opts.cwd ?? process.cwd() }))
    }
  }

  get peerId(): string | undefined { return this.client.peerId }
  async join(): Promise<{ peerId: string }> { await this.client.connect(); return { peerId: this.client.peerId! } }
  peers(): Promise<PeerSummary[]> { return this.client.peers() }
  ask(peer: string, question: string): Promise<string> { return this.client.ask(peer, question) }
  inbox(): InboxAnswer[] { const out = this.buf; this.buf = []; return out }
  leave(): void { this.client.close() }
}
```

- [ ] **Step 4: Run, expect PASS (2 tests). Commit**

```bash
bun test test/agentSession.integration.test.ts
git add src/agentSession.ts test/agentSession.integration.test.ts
git commit -m "feat: AgentSession with inbox and attached responder"
```

---

## Task 2: MCP tools

**Files:** Modify `package.json` (add `@modelcontextprotocol/sdk`); Create `src/mcp.ts`; Test `test/mcp.test.ts`

**Interfaces:**
- Consumes: `AgentSession` from `./agentSession`.
- Produces: `interface ToolDef { name: string; description: string; inputSchema: Record<string, unknown>; handler: (args: Record<string, unknown>) => Promise<string> }`; `vibegroupTools(session: AgentSession): ToolDef[]` (names: `vibegroup_peers`, `vibegroup_ask`, `vibegroup_inbox`, `vibegroup_status`, `vibegroup_leave`).

- [ ] **Step 1: Add the SDK**

```bash
cd /Volumes/terry-hd/side-projects/vibegroup
bun add @modelcontextprotocol/sdk
```

- [ ] **Step 2: Failing test**

`test/mcp.test.ts`:

```ts
import { test, expect, afterEach } from 'bun:test'
import { startRelay, type RelayHandle } from '@vibegroup/relay'
import { AgentSession } from '../src/agentSession'
import { vibegroupTools } from '../src/mcp'
import type { AnswerEngine } from '../src/responder'

let relay: RelayHandle | undefined
afterEach(() => { relay?.stop(); relay = undefined })

async function setup() {
  relay = startRelay({ port: 0, secret: 's' })
  const { room, token } = await (await fetch(`http://localhost:${relay.port}/rooms`, { method: 'POST' })).json() as { room: string; token: string }
  return { url: `ws://localhost:${relay.port}/ws`, room, token }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

test('exposes the expected tool names with schemas', async () => {
  const cfg = await setup()
  const s = new AgentSession({ ...cfg, name: 'alice' })
  const names = vibegroupTools(s).map((t) => t.name).sort()
  expect(names).toEqual(['vibegroup_ask', 'vibegroup_inbox', 'vibegroup_leave', 'vibegroup_peers', 'vibegroup_status'])
  for (const t of vibegroupTools(s)) expect(t.inputSchema).toBeDefined()
})

test('the ask + inbox tools complete a round trip', async () => {
  const cfg = await setup()
  const engine: AnswerEngine = { answer: async (q) => `re: ${q}` }
  const bob = new AgentSession({ ...cfg, name: 'bob', engine, cwd: '/proj' })
  const alice = new AgentSession({ ...cfg, name: 'alice' })
  await bob.join(); await alice.join()

  const tools = vibegroupTools(alice)
  const ask = tools.find((t) => t.name === 'vibegroup_ask')!
  const inbox = tools.find((t) => t.name === 'vibegroup_inbox')!

  const qid = (await ask.handler({ peer: bob.peerId!, question: 'status?' })).trim()
  let out = ''
  for (let i = 0; i < 100 && !out.includes('re: status?'); i++) { await sleep(20); out += await inbox.handler({}) }
  expect(out).toContain('re: status?')
  expect(out).toContain(qid)
  alice.leave(); bob.leave()
})
```

- [ ] **Step 3: Run, verify it fails** (`Cannot find module '../src/mcp'`).

- [ ] **Step 4: Implement**

`src/mcp.ts`:

```ts
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
      description: 'Show this agent\'s vibegroup connection status.',
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
```

- [ ] **Step 5: Run, expect PASS (2 tests). Commit**

```bash
bun test test/mcp.test.ts
git add package.json bun.lock src/mcp.ts test/mcp.test.ts
git commit -m "feat: vibegroup MCP tools over the agent session"
```

---

## Task 3: Standalone daemon CLI

**Files:** Create `src/cli.ts`; Test `test/cli.test.ts`. Modify `package.json` (add `bin`).

**Interfaces:**
- Produces: `interface CliArgs { room: string; url: string; token: string; name: string; model?: string }`; `parseArgs(argv: string[], env: Record<string, string | undefined>): CliArgs` (throws on missing room/token/url); `main(argv: string[], env): Promise<AgentSession>`.

- [ ] **Step 1: Failing test**

`test/cli.test.ts`:

```ts
import { test, expect } from 'bun:test'
import { parseArgs } from '../src/cli'

test('parseArgs reads room from positional and rest from flags/env', () => {
  const a = parseArgs(['join', 'rm_1', '--token', 'tok', '--name', 'libagent'], { VIBEGROUP_RELAY_URL: 'ws://h/ws' })
  expect(a).toEqual({ room: 'rm_1', url: 'ws://h/ws', token: 'tok', name: 'libagent', model: undefined })
})

test('parseArgs falls back to env for url/token/name/model', () => {
  const a = parseArgs(['join', 'rm_2'], {
    VIBEGROUP_RELAY_URL: 'ws://h/ws', VIBEGROUP_TOKEN: 'envtok', VIBEGROUP_NAME: 'n', VIBEGROUP_MODEL: 'haiku',
  })
  expect(a).toEqual({ room: 'rm_2', url: 'ws://h/ws', token: 'envtok', name: 'n', model: 'haiku' })
})

test('parseArgs throws when required values are missing', () => {
  expect(() => parseArgs(['join', 'rm_3'], {})).toThrow()
})
```

- [ ] **Step 2: Run, verify it fails.**

- [ ] **Step 3: Implement**

`src/cli.ts`:

```ts
import { AgentSession } from './agentSession'
import { claudeAnswerEngine } from './responder'

export interface CliArgs { room: string; url: string; token: string; name: string; model?: string }

export function parseArgs(argv: string[], env: Record<string, string | undefined>): CliArgs {
  if (argv[0] !== 'join' || !argv[1]) throw new Error('usage: vibegroup join <room> [--token t] [--name n] [--relay url] [--model m]')
  const room = argv[1]
  const flag = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }
  const url = flag('--relay') ?? env.VIBEGROUP_RELAY_URL
  const token = flag('--token') ?? env.VIBEGROUP_TOKEN
  const name = flag('--name') ?? env.VIBEGROUP_NAME ?? 'vibegroup-agent'
  const model = flag('--model') ?? env.VIBEGROUP_MODEL
  if (!url) throw new Error('missing relay url (--relay or VIBEGROUP_RELAY_URL)')
  if (!token) throw new Error('missing token (--token or VIBEGROUP_TOKEN)')
  return { room, url, token, name, model }
}

export async function main(argv: string[], env: Record<string, string | undefined>): Promise<AgentSession> {
  const a = parseArgs(argv, env)
  const session = new AgentSession({
    url: a.url, room: a.room, token: a.token, name: a.name,
    engine: claudeAnswerEngine({ cwd: process.cwd(), model: a.model }), cwd: process.cwd(),
  })
  const { peerId } = await session.join()
  console.log(`vibegroup: joined ${a.room} as ${a.name} (${peerId}); answering peer questions read-only.`)
  return session
}

if (import.meta.main) {
  main(process.argv.slice(2), process.env).catch((e) => { console.error(String(e?.message ?? e)); process.exit(1) })
}
```

- [ ] **Step 4: Run, expect PASS (3 tests).**

- [ ] **Step 5: Add the bin to `package.json`** (merge into the existing manifest):

```json
  "bin": { "vibegroup": "./src/cli.ts" },
```

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts test/cli.test.ts package.json
git commit -m "feat: standalone vibegroup join daemon"
```

---

## Task 4: Claude Code plugin packaging

**Files:** Create `.claude-plugin/plugin.json`, `.mcp.json`, `commands/vibegroup.md`, `hooks/hooks.json`, `hooks/session-start.sh`; Test `test/plugin.test.ts`

- [ ] **Step 1: Failing test**

`test/plugin.test.ts`:

```ts
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
  expect(m.mcpServers.vibegroup.args.join(' ')).toContain('src/mcpServer.ts')
})

test('the slash command and hook files exist', async () => {
  expect(await Bun.file('commands/vibegroup.md').exists()).toBe(true)
  expect(await Bun.file('hooks/hooks.json').exists()).toBe(true)
})
```

- [ ] **Step 2: Run, verify it fails.**

- [ ] **Step 3: Create the files**

`.claude-plugin/plugin.json`:

```json
{
  "name": "vibegroup",
  "version": "0.0.1",
  "description": "Ask peer Claude Code agents in other repos/machines questions over a vibegroup relay.",
  "mcpServers": ".mcp.json",
  "commands": "./commands",
  "hooks": "./hooks/hooks.json"
}
```

`.mcp.json`:

```json
{
  "mcpServers": {
    "vibegroup": {
      "command": "bun",
      "args": ["run", "src/mcpServer.ts"],
      "env": {
        "VIBEGROUP_RELAY_URL": "${VIBEGROUP_RELAY_URL}",
        "VIBEGROUP_ROOM": "${VIBEGROUP_ROOM}",
        "VIBEGROUP_TOKEN": "${VIBEGROUP_TOKEN}",
        "VIBEGROUP_NAME": "${VIBEGROUP_NAME}",
        "VIBEGROUP_MODEL": "${VIBEGROUP_MODEL}"
      }
    }
  }
}
```

`src/mcpServer.ts` (the MCP entrypoint that auto-joins from env, with a responder):

```ts
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
```

`commands/vibegroup.md`:

```markdown
---
description: Work with your vibegroup room (peers, ask, inbox, status)
---

Use the vibegroup MCP tools to collaborate with peer agents:

- `vibegroup_peers` — who is in the room and what they're working on
- `vibegroup_ask` — ask a peer a question (returns a qid; non-blocking)
- `vibegroup_inbox` — collect answers that have arrived
- `vibegroup_status` — your connection status
- `vibegroup_leave` — leave the room

To ask a peer: first call `vibegroup_peers` to find their peerId, then `vibegroup_ask`, then check `vibegroup_inbox` on a later turn for the answer.

$ARGUMENTS
```

`hooks/hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [
      { "matcher": "", "hooks": [ { "type": "command", "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh\"", "async": false } ] }
    ]
  }
}
```

`hooks/session-start.sh`:

```bash
#!/usr/bin/env bash
# Inject a short note so the agent knows vibegroup is available this session.
cat <<'NOTE'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"vibegroup is available: use vibegroup_peers to see room members, vibegroup_ask to ask a peer (returns a qid), and vibegroup_inbox to collect answers. Incoming peer questions are answered automatically by a read-only responder."}}
NOTE
```

- [ ] **Step 4: Make the hook executable, run the test, expect PASS (3 tests)**

```bash
chmod +x hooks/session-start.sh
bun test test/plugin.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin .mcp.json commands hooks src/mcpServer.ts test/plugin.test.ts
git commit -m "feat: Claude Code plugin packaging (mcp server, command, session-start hook)"
```

---

## Task 5: Full suite + README

**Files:** Create/append `README.md`; run the whole suite.

- [ ] **Step 1: Write `README.md`** (repo root):

```markdown
# vibegroup (agent)

Ask peer Claude Code agents in other repos/machines questions over the internet, and answer theirs from a sandboxed read-only responder.

- `RelayClient` + per-room E2E (`crypto.ts`) — encrypted transport to the [relay](https://github.com/TerryCM/vibegroup-relay).
- `responder.ts` — answers inbound questions via a read-only `claude -p` (no write/exec/secret access), redacted.
- `AgentSession` / `mcp.ts` — the MCP tools (`vibegroup_peers/ask/inbox/status/leave`).
- `cli.ts` — `vibegroup join <room>` standalone answering daemon.
- `.claude-plugin/` — Claude Code plugin (MCP server + `/vibegroup` command + SessionStart hook).

Depends on `@vibegroup/protocol`; for local dev the relay/protocol are sibling repos linked via `file:`.

```bash
bun install
bun test
```

Set `VIBEGROUP_RELAY_URL`, `VIBEGROUP_ROOM`, `VIBEGROUP_TOKEN`, `VIBEGROUP_NAME`, `VIBEGROUP_MODEL` to connect.
```

- [ ] **Step 2: Run the whole hermetic suite, expect PASS**

Run: `bun test`
Expected: all green (live claude smoke skipped).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: agent README"
```

---

## Self-Review

**Spec coverage (rev-2 §3.2 asker tools, §3.3 plugin, daemon):**
- Asker tools join/peers/ask/inbox/leave → Tasks 1–2. ✅
- MCP server → Task 2 `startMcpServer` + Task 4 `mcpServer.ts`. ✅
- Standalone daemon → Task 3. ✅
- Plugin (mcp config, `/vibegroup`, SessionStart context hook) → Task 4. ✅
- Responder attached in-session and in the daemon → `AgentSession` engine wiring (Task 1), used in Tasks 3–4. ✅

**Deferred (noted):** the live inbox-nudge that injects pending-answer counts mid-session (requires MCP↔hook IPC; the SessionStart note is the MVP stand-in); auto-reconnect; presence `busy`/status updates; multi-turn threads. These are post-MVP.

**Placeholder scan:** none. **Type consistency:** `AgentSession`, `ToolDef`, `CliArgs`, `vibegroupTools`, `claudeAnswerEngine({model})` consistent across tasks.

---

## Execution Handoff

Inline execution to completion.
