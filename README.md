<h1 align="center">vibegroup ☎️</h1>

<p align="center">
  <strong>Build with your crew — and let your agents do the same.</strong><br>
  Claude Code sessions that talk to each other across repos, machines, and networks.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/status-alpha-orange" alt="Status: alpha">
  <img src="https://img.shields.io/badge/tests-62_passing-brightgreen" alt="62 tests passing">
  <img src="https://img.shields.io/badge/runtime-Bun-000000?logo=bun&logoColor=white" alt="Bun">
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict">
  <img src="https://img.shields.io/badge/MCP-server-5a45ff" alt="MCP server">
  <img src="https://img.shields.io/badge/E2E-AES--256--GCM-1f6feb" alt="End-to-end encrypted">
  <img src="https://img.shields.io/badge/macOS_%7C_Linux-supported-lightgrey" alt="macOS | Linux">
</p>

The best building happens in good company — but when you and your friends are each heads-down in your own repo on your own machine, your agents are strangers to each other. Yours has no idea what theirs just shipped.

vibegroup ends that isolation. Drop into a shared room and your agents start talking: a friend's agent asks yours what the new importer API looks like, whether you pushed the migration, what branch you're on — and yours answers on its own, straight from your real checkout. The easy back-and-forth you have with your friends finally reaches the agents working beside you.

```
  Y's agent:  vibegroup_ask(alice-lib, "what's the new importer API?")
                       │  (sealed, E2E)                       ▲  (sealed, E2E)
                       ▼                                       │
                  ──────────────  vibegroup relay  ──────────────
                       │                                       ▲
                       ▼                                       │
  X's machine:  a read-only `claude -p` reads git + files + transcript,
                answers "POST /imports, batched; see importer.ts", redacts secrets
                       │
                       ▼
  Y's agent:  vibegroup_inbox() → "POST /imports, batched; see importer.ts"
```

No human in the loop on the answering side. No exposing your live session. No copy-paste.

---

## Why vibegroup

- **Made for a group of friends, not a fleet.** A *vibegroup* is just a room you and your friends join from wherever you're coding. Low ceremony: spin one up, share the token, start asking. No org, no setup, no babysitting.
- **Cross-machine, over the internet.** Agents connect *outbound* to a relay, so NAT and firewalls are a non-issue. Two laptops, two clouds, a laptop and a CI box — all the same.
- **Answers from the *real* checkout, safely.** Incoming questions are answered by a **dedicated, read-only `claude -p`** — it can read git state, files, and the session transcript, but it has **no write, no exec, no network, and no access to secret files**. A malicious or prompt-injected question literally cannot damage your machine, because the capabilities aren't there.
- **End-to-end encrypted.** Question and answer bodies are sealed with AES-256-GCM under a key derived from the room token. The relay routes **ciphertext only** — it never sees your code, even the one you run yourself.
- **Built for public Claude Code.** No internal builds, no feature flags. It's an ordinary MCP server + plugin, plus a relay you host. Works with the Claude Code everyone already has.
- **Non-blocking by design.** `vibegroup_ask` returns immediately with a ticket; answers arrive asynchronously into your inbox. No deadlocks when everyone is asking everyone.
- **Signed identities.** The relay stamps the authoritative sender — peers can't spoof who they are.

---

## How it works

vibegroup is deliberately **asymmetric**, because asking and answering have different needs:

| | Asking (you're active) | Answering (you might be away) |
|---|---|---|
| Mechanism | a plain MCP tool call | a sandboxed read-only `claude -p` |
| Blocking? | no — returns a `qid` | no — runs beside your session |
| Privilege | your session | **least-privilege, read-only** |

Your agent asks with a normal tool call (it's already mid-turn, so nothing special is needed). A peer's question is answered by a separate, locked-down process — never your live, privileged session. That single decision is what makes "agents answer each other automatically" both **useful** and **safe**.

It ships as three small pieces:

| Repo | What it is |
|---|---|
| **[vibegroup](https://github.com/TerryCM/vibegroup)** (this repo) | the local agent: relay client, E2E crypto, read-only responder, MCP tools, daemon, and the Claude Code plugin |
| **[vibegroup-relay](https://github.com/TerryCM/vibegroup-relay)** | the broker you host — rooms, signed identity, ciphertext routing, offline queue. Never decrypts anything. |
| **[vibegroup-protocol](https://github.com/TerryCM/vibegroup-protocol)** | the shared wire contract both sides depend on |

---

## Quick start

> **Status:** vibegroup is **alpha**. It works end-to-end and is test-covered, but it hasn't been packaged for one-line install yet — you clone and run. The live responder needs a Claude login with headless API credit (`claude -p`); without it, the responder degrades gracefully to a safe "couldn't answer" reply.

You'll need [Bun](https://bun.sh) ≥ 1.1.

**1. Clone the three repos side by side** (the local `file:` links expect siblings):

```bash
git clone https://github.com/TerryCM/vibegroup-protocol
git clone https://github.com/TerryCM/vibegroup-relay
git clone https://github.com/TerryCM/vibegroup
```

**2. Run the relay** — or skip this and point at the public **alpha instance** (`wss://vibegroup-relay.grayriver-52f1583a.eastus.azurecontainerapps.io/ws`; see [`vibegroup-relay/DEPLOY.md`](https://github.com/TerryCM/vibegroup-relay/blob/main/DEPLOY.md)). To self-host:

```bash
cd vibegroup-relay && bun install && PORT=8799 RELAY_SECRET=$(openssl rand -hex 16) bun run start
```

**3. Create a room** and share the token with your teammate out-of-band:

```bash
curl -X POST http://localhost:8799/rooms
# → {"room":"rm_…","token":"…"}
```

**4. Join from each checkout** — this makes the checkout answerable:

```bash
cd vibegroup && bun install
export VIBEGROUP_RELAY_URL=wss://vibegroup-relay.grayriver-52f1583a.eastus.azurecontainerapps.io/ws  # alpha instance, or your own
export VIBEGROUP_ROOM=rm_…
export VIBEGROUP_TOKEN=…
export VIBEGROUP_NAME=alice-lib       # how peers see you
export VIBEGROUP_MODEL=…              # a model available for headless `claude -p`

bun run src/cli.ts join "$VIBEGROUP_ROOM"
```

**5. Ask from inside Claude Code** — load the plugin (`--plugin-dir ./vibegroup` or add it to `~/.claude/settings.json`) so the `vibegroup_*` tools and `/vibegroup` command are available, then:

```
You: ask alice-lib what the new importer API looks like
Agent → vibegroup_peers()                          # find alice-lib's peerId
Agent → vibegroup_ask(peer, "new importer API?")   # returns a qid
Agent → vibegroup_inbox()                          # a moment later: the answer
```

---

## MCP tools

| Tool | Description |
|---|---|
| `vibegroup_peers` | List the agents in your room and what they're working on. |
| `vibegroup_ask` | Ask a peer a question. Returns a `qid` immediately (non-blocking). |
| `vibegroup_inbox` | Collect answers that have arrived since the last check. |
| `vibegroup_status` | Your connection status. |
| `vibegroup_leave` | Leave the room. |

Incoming questions are answered automatically by the read-only responder — no tool call needed on the answering side.

---

## Configuration

| Variable | Description |
|---|---|
| `VIBEGROUP_RELAY_URL` | WebSocket URL of the relay (e.g. `wss://relay.example/ws`). |
| `VIBEGROUP_ROOM` | Room id from the relay's `POST /rooms`. |
| `VIBEGROUP_TOKEN` | Room token — used for both relay auth **and** deriving the E2E key. |
| `VIBEGROUP_NAME` | Display name peers see. |
| `VIBEGROUP_MODEL` | Model for the responder's `claude -p` (pin one available for headless runs). |

---

## Security model

Untrusted input crossing the internet into something that can touch your machine deserves real containment, not a polite prompt. vibegroup's defenses are structural:

- **Least-privilege responder.** Answers run in a separate `claude -p` with a read-only tool allowlist (`Read`, `Grep`, `Glob`, read-only `git`) and an explicit denylist for `Write`/`Edit`/network. It *can't* exfiltrate or mutate — the tools don't exist in that context.
- **End-to-end encryption.** Per-room AES-256-GCM; the relay routes ciphertext and never holds a key.
- **Secret redaction.** Answers are scrubbed for API keys, tokens, private-key blocks, and `SECRET=`-style assignments, then length-capped, before they leave.
- **Signed identity.** The relay stamps the authoritative sender; clients can't assert someone else's `from`.
- **Private rooms.** Membership is gated by a token shared out-of-band.

Found a security issue? Please open an issue — we want to know.

---

## Project status & roadmap

vibegroup is an early but working MVP.

- ✅ **Relay broker** — rooms, signed identity, ciphertext routing, qid lifecycle, offline queue + resume.
- ✅ **Agent** — E2E crypto, relay client, read-only responder, MCP tools, standalone daemon, Claude Code plugin.
- ⏳ **One-line install** — packaging for `/plugin install` and a hosted public relay.
- ⏳ **E2E key rotation** on membership change; permission relay; presence richness.
- 🔬 **Live mode** *(researching)* — optionally answer from the *live* session via [Claude Code Channels](https://code.claude.com/docs/en/channels) for full in-context fidelity, gated behind a proof that idle sessions can be woken safely.

---

## Development

```bash
bun install
bun test            # hermetic; the live `claude -p` smoke test is opt-in
```

Run the live responder smoke test (needs Claude headless credit):

```bash
VIBEGROUP_E2E_CLAUDE=1 VIBEGROUP_E2E_CLAUDE_MODEL=<model> bun test test/claudeEngine.smoke.test.ts
```

The full design and implementation plans live under [`docs/`](docs/superpowers).

---

## License

[MIT](LICENSE).
