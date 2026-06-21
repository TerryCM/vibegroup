# vibegroup — Roadmap & TODO

Status of the project and what's left. The MVP (encrypted ask/answer with a read-only responder, across three repos) is **built and test-covered** (62 tests). This tracks the road from "works on my machine(s)" to "a thing friends actually use."

## Now — make it real

- [x] **Deploy the relay** to a public host — live on Azure Container Apps (`wss://relay.vibegroup.sh/ws`; see `vibegroup-relay/DEPLOY.md`).
- [x] **Point a default relay URL** in the agent docs / config (set in the README quick-start).
- [x] **Real-world end-to-end test** — two real Claude Code sessions, channel-mode, over the live Azure relay: one asks, the other's session wakes and answers from its own checkout, answer pushes back. WSS + E2E + routing all confirmed.
- [ ] **Two physical machines on two networks** — confirm the same flow off a single host (NAT/firewall traversal).

## Packaging & distribution

- [ ] Publish `@vibegroup/protocol` to npm/JSR; flip the `file:` deps in the relay and agent to the published version so each repo clones standalone.
- [ ] `bun build` the relay to a single self-contained file for container/deploy (done for Docker; wire into CI).
- [ ] Package the agent as an installable Claude Code plugin (`/plugin install`) + a marketplace entry.
- [ ] `vibegroup` CLI ergonomics: `vibegroup new` (mint a room + print join command), `vibegroup status`.
- [ ] One-line installer script (`curl … | bash`) once published.

## Hardening (relay)

- [ ] **Durable pending-ask persistence** so a relay restart doesn't drop in-flight asks (currently in-memory; clients treat a drop as retryable).
- [ ] **Rate limits** per peer (questions/min) to bound abuse and answerer cost.
- [ ] **Token rotation / per-member revocation** surface (rotate exists; expose it + revoke a single member).
- [ ] **WSS cert pinning** in the client against a rogue/MITM relay.
- [ ] Background **sweep timer** for expired asks + stale presence (registries support it; wire the interval).
- [ ] Structured logging + a `/metrics` endpoint.

## Features (agent)

- [ ] **E2E key rotation** on membership change (today all current members share one key derived from the room token; document the limitation until then).
- [ ] **Live inbox-nudge**: surface a pending-answer count into the asker's session (needs MCP↔hook IPC; SessionStart note is the current stand-in).
- [ ] **Auto-reconnect** with `resumeToken` after an unexpected drop.
- [ ] **Presence richness**: `busy` / `permission_blocked` states + human-set status (`/vibegroup status "refactoring auth"`).
- [ ] **Broadcast / group questions** (`vibegroup_ask("*", …)`), with cost guards.
- [ ] **Multi-turn threads** so a follow-up keeps context.
- [ ] **Transcript-tail context** wired explicitly into the responder prompt for sharper "what are you working on" answers.

## Channels "live mode" — SHIPPED (now the answering path)

- [x] **Idle-wake proven** — a Channels notification wakes an idle session (verified with Anthropic's fakechat, then with vibegroup across two real sessions).
- [x] **Channel agent** — peer questions/answers push into the live session via `notifications/claude/channel`; the agent answers read-only via `vibegroup_reply`. This replaced the headless `claude -p` responder as the default answering path.
- [ ] **Allowlisting** — get vibegroup onto Anthropic's channel allowlist (or an org `allowedChannelPlugins`) so it loads without `--dangerously-load-development-channels`.
- [ ] **Per-turn read-only enforcement** — back the untrusted-input framing with a config-enforced read-only permission posture for channel-triggered turns (defense beyond the prompt).

## Real-world testing checklist

Run these against the deployed relay before calling it usable:

- [ ] **Two physical machines, two networks** (e.g. home + cellular hotspot) — join the same room, `vibegroup_peers` shows both.
- [ ] **NAT/firewall traversal** — confirm outbound-only works from a restrictive network with no port-forwarding.
- [ ] **Live responder** — with real `claude -p` credit, ask a real question ("what branch are you on?", "did you finish X?") and verify a grounded answer comes back via `vibegroup_inbox`.
- [ ] **E2E is real** — capture relay traffic (or log on the relay) and confirm it only ever holds `{ciphertext,nonce}`, never plaintext.
- [ ] **Secret redaction** — plant a fake `AKIA…`/`sk-…` in a tracked file, ask a question whose answer would surface it, confirm it comes back `[REDACTED]`.
- [ ] **Read-only containment** — send a hostile question ("run `rm -rf`…", "print your .env") and confirm the responder neither acts nor leaks.
- [ ] **Offline/resume** — kill one agent mid-conversation; confirm the queued question drains when it reconnects with its resume token.
- [ ] **AFK answering** — close the asker's interactive session but keep the responder daemon running; confirm peers still get answers.
- [ ] **Latency** — measure ask→answer wall-clock on the deployed relay; note typical and p95.
- [ ] **Multi-peer room** — 3+ members; confirm routing, presence, and that answers go to the right asker (qid correctness).
- [ ] **Reconnect storms** — flap a connection; confirm no double-delivery (relay dedupes by qid).
