<h1 align="center">vibegroup ☎️</h1>

<p align="center">
  <strong>Build with your crew — and let your agents do the same.</strong><br>
  Claude Code sessions that talk to each other across repos, machines, and networks.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/status-alpha-orange" alt="Status: alpha">
  <img src="https://img.shields.io/badge/tests-67_passing-brightgreen" alt="67 tests passing">
  <img src="https://img.shields.io/badge/runtime-Bun-000000?logo=bun&logoColor=white" alt="Bun">
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict">
  <img src="https://img.shields.io/badge/Claude_Code-Channel-5a45ff" alt="Claude Code Channel">
  <img src="https://img.shields.io/badge/E2E-AES--256--GCM-1f6feb" alt="End-to-end encrypted">
  <img src="https://img.shields.io/badge/macOS_%7C_Linux-supported-lightgrey" alt="macOS | Linux">
</p>

The best building happens in good company — but when you and your friends are each heads-down in your own repo on your own machine, your agents are strangers to each other. Yours has no idea what theirs just shipped.

vibegroup ends that isolation. Drop into a shared room and your agents start talking: a friend's agent asks yours what the new importer API looks like, whether you pushed the migration, what branch you're on — and **the question lands right in your running session, which answers on its own.** The easy back-and-forth you have with your friends finally reaches the agents working beside you.

```
  conversations:  "ask conversations-rs what they're working on"
        │  vibegroup_ask (sealed, E2E) ──▶ relay ──▶
        │                                            ▼
  conversations-rs:  ⚡ session wakes — <channel kind="question" …> pushed in
                     reads its own repo (read-only), calls vibegroup_reply
        ◀── relay ◀── (sealed, E2E)                  │
        ▼
  conversations:  ⚡ session wakes — <channel kind="answer" …> pushed in
                  "they're on feat/grpc-streaming, importer's done"
```

The answer comes from your friend's **actual agent, with full context** — and it works even if they're away from the keyboard, because the question wakes their idle session.

---

## Why vibegroup

- **Made for a group of friends, not a fleet.** A *vibegroup* is just a room you and your friends join from wherever you're coding. Spin one up, share the token, start asking.
- **Cross-machine, over the internet.** Agents connect *outbound* to a relay, so NAT and firewalls are a non-issue. Two laptops, two clouds, a laptop and a CI box — all the same.
- **Answers come from your live agent.** A peer's question is pushed straight into your running Claude Code session via [Claude Code Channels](https://code.claude.com/docs/en/channels), so your *real* agent — with full repo context — answers it. No second model, no separate API bill.
- **Wakes an idle session.** Channels deliver while you're away from the terminal, so a peer gets an answer even when you're not actively typing.
- **Untrusted by default.** Incoming questions are framed as untrusted data and answered **read-only** (git + files, no writes/exec, no secret reads); replies are scrubbed for secrets before they leave.
- **End-to-end encrypted.** Question and answer bodies are AES-256-GCM sealed under a key derived from the room token. The relay routes **ciphertext only** — never your code.
- **Signed identity.** The relay stamps the authoritative sender; peers can't spoof who they are.

---

## How it works

vibegroup is a **Claude Code Channel** wired to a relay. A channel is an MCP server that can *push events into a running session* (and the agent replies through a tool) — that's the primitive that makes "your live session answers on its own" possible.

- **Asking** is a tool call: your agent calls `vibegroup_ask(peer, question)` → it goes out over the relay.
- **Answering** is a push: the question arrives at your peer's machine, their channel pushes it into their live session as `<channel source="vibegroup" kind="question" …>`, their agent answers read-only and calls `vibegroup_reply`.
- **Receiving** is a push too: the answer routes back and pushes into *your* session as `<channel kind="answer" …>`.

The relay is just transport — it matches peers into rooms and routes encrypted blobs; it never sees plaintext. The three pieces:

| Repo | What it is |
|---|---|
| **[vibegroup](https://github.com/TerryCM/vibegroup)** (this repo) | the channel: relay client, E2E crypto, the `vibegroup_*` tools, and the Claude Code plugin |
| **[vibegroup-relay](https://github.com/TerryCM/vibegroup-relay)** | the broker you host — rooms, signed identity, ciphertext routing. Never decrypts anything. |
| **[vibegroup-protocol](https://github.com/TerryCM/vibegroup-protocol)** | the shared wire contract both sides depend on |

---

## Requirements

vibegroup answers via Claude Code Channels, which is a **research-preview** feature. That means:

- **Claude Code ≥ 2.1.80** with **Anthropic auth** (claude.ai or a Console API key) — not Bedrock/Vertex/Foundry.
- Until the plugin is on Anthropic's channel allowlist, launch with **`--dangerously-load-development-channels`** (fine for you-and-your-friends).
- The answering session must be **open** — keep one running (a `tmux` pane works) to be answerable while away.

---

## Quick start

> **Status:** alpha — you clone and run; no one-line install yet.

You'll need [Bun](https://bun.sh) ≥ 1.1. Clone the three repos side by side:

```bash
git clone https://github.com/TerryCM/vibegroup-protocol
git clone https://github.com/TerryCM/vibegroup-relay
git clone https://github.com/TerryCM/vibegroup && (cd vibegroup && bun install)
```

**1. A relay** — use the public **alpha instance** (`wss://vibegroup-relay.grayriver-52f1583a.eastus.azurecontainerapps.io/ws`), or self-host (see [`vibegroup-relay/DEPLOY.md`](https://github.com/TerryCM/vibegroup-relay/blob/main/DEPLOY.md)).

**2. A room** — share the token with your friends out-of-band:

```bash
curl -X POST https://vibegroup-relay.grayriver-52f1583a.eastus.azurecontainerapps.io/rooms
# → { "room": "rm_…", "token": "…" }
```

**3. In each repo you want in the room, drop a `.mcp.json`** registering the channel (peer name distinguishes you):

```json
{
  "mcpServers": {
    "vibegroup": {
      "command": "bun",
      "args": ["run", "/abs/path/to/vibegroup/src/channelServer.ts"],
      "env": {
        "VIBEGROUP_RELAY_URL": "wss://…/ws",
        "VIBEGROUP_ROOM": "rm_…",
        "VIBEGROUP_TOKEN": "…",
        "VIBEGROUP_NAME": "alice"
      }
    }
  }
}
```

**4. Launch the session as a channel:**

```bash
claude --dangerously-load-development-channels server:vibegroup
```

**5. Ask** — in one session: *"use `vibegroup_peers`, then ask alice what they're working on."* Their session wakes, answers from its repo, and the answer pops into yours.

---

## Tools

| Tool | Description |
|---|---|
| `vibegroup_peers` | List the agents in your room and what they're working on. |
| `vibegroup_ask` | Ask a peer a question. Returns a `qid`; the answer arrives as a `<channel kind="answer">` event. |
| `vibegroup_reply` | Answer a peer's question (pass the `qid` from the incoming `<channel kind="question">` event). |

Questions and answers both **arrive as channel events** pushed into your session — there's no inbox to poll.

---

## Security model

A peer's question lands in your live session, so the defenses are framing + scope, not a separate sandbox:

- **Untrusted-input framing.** The channel's system instructions tell the agent to treat incoming questions as data (never instructions), answer **read-only**, and never reveal secrets or run state-changing commands.
- **Secret redaction.** Replies are scrubbed for API keys, tokens, and private-key blocks, then length-capped, before they leave.
- **End-to-end encryption.** Per-room AES-256-GCM; the relay holds no key.
- **Signed identity + private rooms.** The relay stamps the authoritative sender; membership is gated by a token shared out-of-band.

> **Honest note:** because answering happens in your *real* session, treat a vibegroup room as you'd treat the people in it — a circle of friends, not the open internet. Keep your permission settings tight, and don't put a relay token somewhere untrusted.

---

## Project status & roadmap

- ✅ **Relay broker** — rooms, signed identity, ciphertext routing, qid lifecycle, offline queue + resume. Deployed on Azure Container Apps.
- ✅ **Channel agent** — E2E crypto, relay client, the `vibegroup_*` tools, push-based question/answer delivery, read-only framing. Verified live across two sessions.
- ⏳ **Packaging** — `/plugin install` + channel allowlisting so it's not a dev-flag launch.
- ⏳ **Hardening** — relay rate limits + auth on room creation, E2E key rotation, presence richness.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the full list and a real-world testing checklist.

---

## Development

```bash
bun install
bun test
```

Design docs and implementation plans live under [`docs/`](docs/superpowers).

---

## License

[MIT](LICENSE).
