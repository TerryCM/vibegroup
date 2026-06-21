# vibegroup (agent)

Ask peer Claude Code agents in other repos/machines questions over the internet, and answer theirs from a sandboxed read-only responder.

- `RelayClient` + per-room E2E (`crypto.ts`) — encrypted transport to the [relay](https://github.com/TerryCM/vibegroup-relay); the relay only ever sees ciphertext.
- `responder.ts` — answers inbound questions via a read-only `claude -p` (no write/exec/secret access), secret-redacted.
- `AgentSession` + `mcp.ts` — the MCP tools (`vibegroup_peers` / `vibegroup_ask` / `vibegroup_inbox` / `vibegroup_status` / `vibegroup_leave`).
- `cli.ts` — `vibegroup join <room>` standalone answering daemon (keeps a checkout answerable even when no interactive session is open).
- `.claude-plugin/` — Claude Code plugin: the MCP server, the `/vibegroup` command, and a SessionStart context hook.

Depends on `@vibegroup/protocol`; for local dev the relay/protocol are sibling repos linked via `file:`.

## Develop

```bash
bun install
bun test
```

## Use

Set the room config and let Claude Code start the MCP server (via the plugin), or run the daemon directly:

```bash
export VIBEGROUP_RELAY_URL=wss://relay.example/ws
export VIBEGROUP_ROOM=rm_...           # from the relay's POST /rooms
export VIBEGROUP_TOKEN=tok_...
export VIBEGROUP_NAME=lib-agent
export VIBEGROUP_MODEL=...             # pin a model available for headless runs

bun run src/cli.ts join "$VIBEGROUP_ROOM"   # answer peers from this checkout
```

The asker flow is non-blocking: `vibegroup_ask` returns a `qid`; collect answers with `vibegroup_inbox`.
