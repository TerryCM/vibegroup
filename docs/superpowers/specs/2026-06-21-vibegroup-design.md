# vibegroup — Design Spec (rev. 2, post-review)

**Status:** Approved for planning · **Date:** 2026-06-21 · **Supersedes:** rev. 1

## 0. What changed in this revision (from the review panel)

Three independent reviewers (GPT-5.5 + two Opus-4.8 at max effort) found two blockers in rev. 1. This revision inverts the design accordingly:

- **Answering moved out of the privileged live session.** Rev. 1 pushed untrusted remote questions into X's fully-privileged live Claude Code session (Bash/Write/secret access) with `vibegroup_reply` as a built-in exfil path — a prompt-injection RCE, flagged no-go. **Default answering is now a read-only, least-privilege responder, safe by construction.**
- **Channels demoted to an opt-in enhancement.** Rev. 1 bet the whole product on the Channels research preview (allowlist-gated, `--dangerously-load-development-channels`). The default path now needs **no Channels and no allowlist** and works today. Channels "live mode" is a later, gated milestone.
- **Protocol is now symmetric and non-blocking.** Rev. 1's blocking `vibegroup_ask` deadlocks a mesh (X blocked asking Y cannot answer Y). `ask` now returns a `qid` immediately; answers are delivered asynchronously.
- **Hardened:** relay-signed identities (no self-asserted `from`), a `qid` state machine with escaping/dedupe, explicit presence states, delivery/answer acks + sequence numbers, and **per-room E2E encryption in MVP** (relay cannot read content).

## 1. Goal

Let Claude Code agents on **different machines/networks** ask each other questions over the internet and get answers, with no server operated by participants. Canonical flow: Y's agent asks X's project ("what API shape did you land on?", "what branch?", "did you finish the importer?") and gets a grounded answer. A **vibegroup** is a joinable room; members discover each other and exchange questions/answers through a hosted relay.

## 2. Key decisions (rev. 2)

1. **Hosted + self-hostable relay.** A central broker routes between members. We run the default public instance; the broker is open source. Participants run **no server** — a local agent process only.
2. **Default answering = read-only responder, safe by construction.** When a question arrives, the local vibegroup agent answers it in a **least-privilege headless `claude -p`**, scoped read-only: it may read repo files, run read-only git, and read the project's on-disk Claude Code transcript; it has **no** Write/Edit, **no** arbitrary Bash/exec, **no** network egress except the relay, a scrubbed env (no secrets), and a denylist for secret paths (`.env`, `~/.ssh`, `~/.aws`, credentials). A hostile/injected question cannot write, exec, or exfiltrate out-of-band because those capabilities do not exist. Answers are secret-redacted before send.
3. **Channels "live mode" is opt-in and gated.** For trusted rooms wanting full-context answers from the live session, a later milestone uses Claude Code Channels to push the question into a running session. It ships only after (a) an **idle-wake proof spike** passes and (b) allowlisting is confirmed, and even then channel-triggered turns run under an **enforced read-only tool policy** — never the ambient privileged toolset, never an auto-approve permission mode.
4. **Symmetric, non-blocking protocol.** `vibegroup_ask(peer, question)` returns `{qid}` immediately. Answers arrive asynchronously and are retrieved with `vibegroup_inbox()`; a lightweight hook nudges the asker on its next turn when answers are pending. No blocking, no mesh deadlock, no orphaned tickets.
5. **Identity is relay-signed.** Clients cannot self-assert `from`. The sender allowlist gates on a relay-signed, room-scoped peer id. Tokens support rotation/revocation; the relay WSS cert is pinned.
6. **E2E in MVP.** Question/answer bodies are encrypted client-side with a per-room key derived from the room token (already shared out-of-band). The relay routes ciphertext and sees only routing metadata. "We can't read your repo" is true at launch.

### Rejected (with reason)
- *Answer from the ambient privileged live session* — prompt-injection RCE / secret exfil via `vibegroup_reply`; no-go.
- *Blocking `vibegroup_ask`* — distributed deadlock in a symmetric mesh; orphaned late answers.
- *Channels as the MVP foundation* — research-preview, allowlist-gated; unproven idle-wake. Now an opt-in enhancement, not a precondition to ship.
- *Activate Claude Code's built-in `UDS_INBOX` cross-session messaging* — build-time gated, compiled out of public releases (verified against live 2.1.183 schema).
- *Bearer-token-only identity* — leaked token = injection rights + spoofable display names.

### Prior art
- `PatilShreyas/claude-code-session-bridge` — local-only (filesystem inbox, blocking `/bridge listen` 3s poll). Confirms the constraints; vibegroup differs by being cross-machine and answering in a sandboxed responder.
- Anthropic official channel plugins (`fakechat`/`telegram`/`discord`/`imessage`) — reference channel implementations and the evidence base for the idle-wake spike.

## 3. Architecture

```
        ┌──────────── HOSTED BY US (the only "server") ─────────────┐
        │  vibegroup relay (open source, self-hostable):            │
        │  rooms · signed identities · routing of CIPHERTEXT ·      │
        │  qid state machine · dedupe · seq/acks · pending-ask      │
        │  persistence · presence(freshness) · offline queue (TTL)  │
        └───────────────▲───────────────────────────▲──────────────┘
              outbound WSS │ (E2E ciphertext)        │ outbound WSS
   X's machine (local agent, no server)     Y's machine (same)
   ┌──────────────────────────────────┐  ┌──────────────────────────────────┐
   │ vibegroup agent (daemon)         │  │ vibegroup agent (daemon)         │
   │  • relay client (WSS)            │  │  • relay client (WSS)            │
   │  • READ-ONLY responder:          │  │  • asker: vibegroup_ask → qid    │
   │      spawn `claude -p` per Q,    │  │  • inbox: collects answers       │
   │      sandboxed read-only         │  │                                  │
   │  • inbox + asker MCP tools       │  │  • (also a responder)            │
   │  • [opt-in later] Channel push   │  │                                  │
   └──────────────────────────────────┘  └──────────────────────────────────┘
        ▲ MCP/stdio + hooks                     ▲ MCP/stdio + hooks
   Claude Code session (X)                Claude Code session (Y)
```

Two deliverables:

### 3.1 Relay broker (hosted; owns routing + identity + reliability)
WebSocket server; members connect outbound only. Responsibilities:
- **Rooms & signed identity:** create room → `{room, ownerToken}`; members redeem a member credential and receive a **relay-signed** `peerId`; verify on every message; support rotation/revocation.
- **Routing of ciphertext:** route `question`/`answer` by `peerId`; never able to decrypt bodies.
- **qid state machine:** `{room, fromPeerId, qid}` → `open|delivered|answered|expired`; dedupe by qid; reject answers that don't reference an open qid.
- **Reliability:** per-peer monotonic `seq`; delivery + answer acks; persist pending asks until answered/expired; on relay restart, return retryable errors to outstanding asks (never silent loss).
- **Presence:** track `available|busy|offline` + `lastSeen`; expose freshness so `peers` never lies.
- **Offline queue:** short per-peer queue (TTL, cap) for brief disconnects; idempotent by qid.

### 3.2 vibegroup agent (local daemon + Claude Code plugin; owns session bridging + answering)
A local process (runnable standalone as `vibegroup join <room>`, and wired into Claude Code via a plugin). Roles:
- **Relay client:** one outbound WSS; holds the per-room key; encrypts/decrypts bodies.
- **Read-only responder (default answering):** on an inbound `question`, spawn a sandboxed headless `claude -p` with the question + a read-only context tool policy; capture the answer; secret-redact; send `answer` referencing the `qid`. Per-question, stateless, bounded cost. Works even if the human's interactive session is closed (transcript is on disk; git is live).
- **Asker MCP tools** (exposed to the local Claude Code session): `vibegroup_join(room, name)`, `vibegroup_peers()`, `vibegroup_ask(peer, question) → {qid}` (non-blocking), `vibegroup_inbox() → answers[]`, `vibegroup_leave()`.
- **Inbox surfacing:** a `UserPromptSubmit`/`Stop` hook injects `additionalContext` like "N vibegroup answer(s) ready — call `vibegroup_inbox`" on the asker's next turn. No blocking.
- **[Opt-in, later] Channel live mode:** registers `claude/channel`; pushes the question into the live session for full-context answers, under an enforced read-only policy. Gated by the idle-wake spike + allowlisting.

## 4. The ask/answer loop (default mode)

1. Y's agent calls `vibegroup_ask("alice-backend", "what branch are you on?")` → returns `{qid: "q_123"}` immediately; Y keeps working.
2. Y's agent encrypts + sends `question` → relay (records qid `open`, routes ciphertext) → X's agent (or queues if X offline).
3. X's agent decrypts, spawns sandboxed `claude -p` ("answer this peer question read-only from repo/git/transcript: …"), gets `"feat/importer; importer done, tests green"`, secret-redacts, sends `answer(qid=q_123)`.
4. Relay marks qid `answered`, routes ciphertext to Y; Y's agent stores it in its inbox; the hook nudges Y on its next turn.
5. Y's agent calls `vibegroup_inbox()` → returns the answer for `q_123`.

(Live mode swaps steps 3–5: the question is channel-pushed into X's live session and the answer channel-pushed back into Y's — still under read-only policy.)

## 5. Security model (by construction, not by prompt)

- **Least-privilege responder:** read-only tool allowlist (Read/Grep/Glob + read-only git wrappers); no Write/Edit/exec, no network except relay, scrubbed env, secret-path denylist. Capability boundary is enforced by config, not by an instructions string.
- **Exfil containment:** answers are size-capped and run through a secret-pattern redactor before send; egress is relay-only.
- **Untrusted-input framing:** question bodies are rendered as clearly-delimited data; the responder prompt forbids treating them as instructions (defense-in-depth on top of the capability boundary).
- **Signed identity:** sender allowlist gates on the relay-signed `peerId`, not a self-asserted display name; rotation/revocation supported; WSS cert pinned against a rogue/MITM relay.
- **E2E:** per-room key from the room token; relay routes ciphertext only.
- **Injection-safe framing:** all envelope/`meta` string values are escaped so a `from`/`qid` containing `"`/`>` cannot break out of its frame.

## 6. Constraints & caveats

- **Default mode** needs only Claude Code installed + the local agent; no Channels, no allowlist, any auth. Works today.
- **Live mode (later)** requires Channels (research preview, v2.1.80+, Anthropic auth, allowlist or `allowedChannelPlugins`), and only ships after the idle-wake spike passes.
- **Responder cost:** one headless `claude -p` per answered question; bounded and on-demand. Rate-limit per peer.
- **"Live context" caveat:** a long-open session auto-compacts; its frozen context is often no fresher than the on-disk transcript the responder already reads — so the responder is not materially worse for status questions, which is the motivating use case.

## 7. MVP scope

**In:** relay (rooms, signed identity, ciphertext routing, qid state machine, dedupe, seq/acks, pending-ask persistence, presence+freshness, offline queue); local vibegroup agent (relay client + per-room E2E, read-only responder via `claude -p`, asker tools `join`/`peers`/`ask`/`inbox`/`leave`, inbox-nudge hook); `/vibegroup` slash commands; the hosted default relay; standalone `vibegroup join` daemon mode.

**Deferred:** Channels live mode (gated milestone — see §8); permission relay; accounts/dashboard/retention; broadcast/group questions; multi-turn threading; rich presence beyond status+freshness.

## 8. Milestones & proof gates

1. **M1 — Relay (foundation):** the broker, fully testable with WS clients (signed identity, qid lifecycle, dedupe, acks, persistence, presence). No Claude Code needed.
2. **M2 — Local agent default mode:** relay client + E2E + read-only responder + asker tools + inbox. End-to-end: two machines run the full ask→answer loop with the live human sessions never touched. **This is the shippable MVP.**
3. **M3 (gated) — Channels live mode:** **Proof spike first** — idle session, emit one channel notification with no other input, assert a turn starts and the reply tool fires (across idle / generating / permission-blocked / reconnected states). Only if it passes (and allowlisting is confirmed) do we build live mode, under an enforced read-only per-turn policy. If it fails, live mode is dropped and the responder remains the answering path.

## 9. Risks & open questions

- **Idle-wake (M3 only):** unproven; gated behind the spike. MVP (M2) does not depend on it.
- **Responder answer quality:** does read-only git+transcript answer "what are you working on" well enough? Validate with real questions during M2; the `claude -p` can do its own read-only exploration.
- **Ask timeout / offline target:** `ask` returns `qid` immediately; relay holds the qid `open` with a TTL; if the peer never answers, `vibegroup_inbox()` surfaces `expired`. Decide TTL default (proposed 10 min).
- **Per-room key rotation** when membership changes (deferred; document the limitation that current members share one key).
- **Standalone-daemon lifecycle** (start/stop, multiple projects on one machine): one daemon per project checkout; peer id is per `{room, checkout}`.
