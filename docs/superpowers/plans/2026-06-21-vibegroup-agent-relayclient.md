# vibegroup Agent — Relay Client + E2E Crypto (M2a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the agent-side `RelayClient` and per-room end-to-end encryption so two local agents can exchange questions/answers through the relay with the relay only ever seeing ciphertext.

**Architecture:** The `vibegroup` repo becomes the agent package (`@vibegroup/agent`). `crypto.ts` derives a per-room AES-256-GCM key from the room token (HKDF) and seals/opens bodies. `relayClient.ts` is a thin WebSocket client that joins a room, sends sealed `question`/`answer` envelopes, and surfaces decrypted inbound messages via handlers. Tests run the **real** `@vibegroup/relay` in-process, proving the wire contract across both implementations.

**Tech Stack:** Bun + TypeScript, `node:crypto` (`hkdfSync`, AES-256-GCM), `bun:test`, the global `WebSocket` client. Depends on `@vibegroup/protocol`; dev-depends on `@vibegroup/relay`.

## Global Constraints

- Runtime **Bun >= 1.1**, language TypeScript, tests `bun:test`. (Copied into every task.)
- E2E: bodies are sealed client-side; the relay never decrypts. Key = `HKDF-SHA256(ikm=roomToken, salt=room, info="vibegroup-e2e-v1", 32 bytes)`; cipher = AES-256-GCM with a fresh 12-byte nonce; `EncBody.ciphertext` is base64 of `encrypted||tag`, `EncBody.nonce` is base64 of the nonce.
- The agent uses the **same room token** for relay auth AND E2E key derivation (it is the already-shared room secret).
- `ask` is **non-blocking**: it resolves with the `qid` once the relay acks routing (delivered OR queued); it does NOT wait for an answer.
- Repos: `vibegroup` (this agent), `vibegroup-protocol` (contract, `file:` dep), `vibegroup-relay` (server, `file:` dev-dep). Source `src/*`, tests `test/*`.
- Work on branch `feat/agent-relayclient` (created in Task 1).

---

## File Structure

```
vibegroup/
  package.json          # rewritten: @vibegroup/agent (was the workspace root)
  tsconfig.json
  src/crypto.ts         # deriveRoomKey / seal / open
  src/relayClient.ts    # RelayClient class
  test/crypto.test.ts
  test/relayClient.integration.test.ts
  docs/...              # unchanged
vibegroup-relay/
  package.json          # Task 2: export startRelay as a library (no import side effects)
```

---

## Task 1: Agent package + E2E crypto

**Files:**
- Modify: `vibegroup/package.json` (rewrite), Create: `vibegroup/tsconfig.json`, `vibegroup/src/crypto.ts`
- Test: `vibegroup/test/crypto.test.ts`

**Interfaces:**
- Consumes: `EncBody` from `@vibegroup/protocol`.
- Produces: `deriveRoomKey(roomToken: string, room: string): Buffer`; `seal(key: Buffer, plaintext: string): EncBody`; `open(key: Buffer, body: EncBody): string` (throws on auth failure).

- [ ] **Step 1: Branch and rewrite the package manifest**

```bash
cd /Volumes/terry-hd/side-projects/vibegroup
git checkout -b feat/agent-relayclient
```

Rewrite `vibegroup/package.json`:

```json
{
  "name": "@vibegroup/agent",
  "version": "0.0.1",
  "type": "module",
  "main": "src/index.ts",
  "scripts": { "test": "bun test" },
  "dependencies": { "@vibegroup/protocol": "file:../vibegroup-protocol" },
  "devDependencies": { "@vibegroup/relay": "file:../vibegroup-relay" }
}
```

Create `vibegroup/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "types": ["bun-types"],
    "skipLibCheck": true,
    "esModuleInterop": true
  }
}
```

Run: `bun install`
Expected: installs, links `@vibegroup/protocol` and `@vibegroup/relay`.

- [ ] **Step 2: Write the failing crypto test**

`vibegroup/test/crypto.test.ts`:

```ts
import { test, expect } from 'bun:test'
import { deriveRoomKey, seal, open } from '../src/crypto'

test('seal then open round-trips with the room key', () => {
  const key = deriveRoomKey('tok_abc', 'rm_1')
  const body = seal(key, 'what branch are you on?')
  expect(open(key, body)).toBe('what branch are you on?')
})

test('a different room token derives a key that cannot open the body', () => {
  const body = seal(deriveRoomKey('tok_abc', 'rm_1'), 'secret answer')
  expect(() => open(deriveRoomKey('tok_DIFFERENT', 'rm_1'), body)).toThrow()
})

test('tampered ciphertext fails authentication', () => {
  const key = deriveRoomKey('tok_abc', 'rm_1')
  const body = seal(key, 'hello')
  const tampered = { ...body, ciphertext: Buffer.from('00'.repeat(40), 'hex').toString('base64') }
  expect(() => open(key, tampered)).toThrow()
})

test('each seal uses a fresh nonce', () => {
  const key = deriveRoomKey('tok_abc', 'rm_1')
  const a = seal(key, 'same')
  const b = seal(key, 'same')
  expect(a.nonce).not.toBe(b.nonce)
  expect(a.ciphertext).not.toBe(b.ciphertext)
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `bun test test/crypto.test.ts`
Expected: FAIL — `Cannot find module '../src/crypto'`.

- [ ] **Step 4: Implement crypto**

`vibegroup/src/crypto.ts`:

```ts
import { hkdfSync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import type { EncBody } from '@vibegroup/protocol'

const INFO = 'vibegroup-e2e-v1'
const TAG_BYTES = 16

export function deriveRoomKey(roomToken: string, room: string): Buffer {
  const dk = hkdfSync('sha256', Buffer.from(roomToken), Buffer.from(room), Buffer.from(INFO), 32)
  return Buffer.from(dk)
}

export function seal(key: Buffer, plaintext: string): EncBody {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    ciphertext: Buffer.concat([enc, tag]).toString('base64'),
    nonce: nonce.toString('base64'),
  }
}

export function open(key: Buffer, body: EncBody): string {
  const buf = Buffer.from(body.ciphertext, 'base64')
  const nonce = Buffer.from(body.nonce, 'base64')
  const enc = buf.subarray(0, buf.length - TAG_BYTES)
  const tag = buf.subarray(buf.length - TAG_BYTES)
  const decipher = createDecipheriv('aes-256-gcm', key, nonce)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}
```

- [ ] **Step 5: Run the crypto test, expect PASS**

Run: `bun test test/crypto.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json src/crypto.ts test/crypto.test.ts bun.lock
git commit -m "feat: agent package and per-room E2E crypto"
```

---

## Task 2: Make the relay importable + RelayClient connect/join

**Files:**
- Modify: `vibegroup-relay/package.json` (library export), Create: `vibegroup/src/relayClient.ts`
- Test: `vibegroup/test/relayClient.integration.test.ts`

**Interfaces:**
- Consumes: `serialize`, `parseEnvelope`, `newMsgId`, `newQid`, `Envelope` from `@vibegroup/protocol`; `deriveRoomKey`, `seal`, `open` from `./crypto`; `startRelay` from `@vibegroup/relay`.
- Produces: `interface RelayClientOptions { url: string; room: string; token: string; name: string }`; `interface PeerSummary { peerId: string; name: string; state: string; lastSeen: number; status?: string }`; `interface IncomingQuestion { from: string; qid: string; question: string }`; `interface IncomingAnswer { from: string; qid: string; answer: string }`; `class RelayClient` with `peerId: string | undefined`, `connect(): Promise<void>`, `ask(toPeerId, question): Promise<string>`, `answer(toPeerId, qid, text): Promise<void>`, `peers(): Promise<PeerSummary[]>`, `onQuestion(handler)`, `onAnswer(handler)`, `close()`. (Tasks 3–4 fill in ask/answer/peers behavior; this task ships connect/join.)

- [ ] **Step 1: Make `@vibegroup/relay` importable as a library (no side effects)**

Rewrite `vibegroup-relay/package.json` so importing the package yields `startRelay` without booting a server (the runnable stays available via the `bin`/`start` script):

```json
{
  "name": "@vibegroup/relay",
  "version": "0.0.1",
  "type": "module",
  "main": "src/server.ts",
  "exports": { ".": "./src/server.ts" },
  "bin": { "vibegroup-relay": "./src/index.ts" },
  "scripts": {
    "start": "bun run src/index.ts",
    "test": "bun test"
  },
  "dependencies": {
    "@vibegroup/protocol": "file:../vibegroup-protocol"
  }
}
```

Commit + push the relay repo:

```bash
cd /Volumes/terry-hd/side-projects/vibegroup-relay
git add package.json
git commit -m "chore: export startRelay as the package entry (separate from the bin)"
git push
cd /Volumes/terry-hd/side-projects/vibegroup
bun install   # re-link the updated relay package
```

- [ ] **Step 2: Write the failing connect test**

`vibegroup/test/relayClient.integration.test.ts`:

```ts
import { test, expect, afterEach } from 'bun:test'
import { startRelay, type RelayHandle } from '@vibegroup/relay'
import { RelayClient } from '../src/relayClient'

let relay: RelayHandle | undefined
afterEach(() => { relay?.stop(); relay = undefined })

async function setup() {
  relay = startRelay({ port: 0, secret: 's' })
  const { room, token } = await (await fetch(`http://localhost:${relay.port}/rooms`, { method: 'POST' })).json() as { room: string; token: string }
  return { url: `ws://localhost:${relay.port}/ws`, room, token }
}

test('connect joins the room and assigns a peerId', async () => {
  const { url, room, token } = await setup()
  const c = new RelayClient({ url, room, token, name: 'alice' })
  await c.connect()
  expect(c.peerId).toMatch(/^p_/)
  c.close()
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `bun test test/relayClient.integration.test.ts`
Expected: FAIL — `Cannot find module '../src/relayClient'`.

- [ ] **Step 4: Implement RelayClient (connect/join now; ask/answer/peers are stubs filled in Tasks 3–4)**

`vibegroup/src/relayClient.ts`:

```ts
import { serialize, parseEnvelope, newMsgId, newQid, type Envelope } from '@vibegroup/protocol'
import { deriveRoomKey, seal, open } from './crypto'

export interface RelayClientOptions { url: string; room: string; token: string; name: string }
export interface PeerSummary { peerId: string; name: string; state: string; lastSeen: number; status?: string }
export interface IncomingQuestion { from: string; qid: string; question: string }
export interface IncomingAnswer { from: string; qid: string; answer: string }

export class RelayClient {
  peerId: string | undefined
  private ws: WebSocket | undefined
  private key: Buffer
  private resumeToken: string | undefined
  private joinWaiter: { resolve: () => void; reject: (e: Error) => void } | undefined
  private ackWaiters = new Map<string, { resolve: () => void; reject: (e: Error) => void }>()
  private peersWaiters: ((p: PeerSummary[]) => void)[] = []
  private questionHandler: ((q: IncomingQuestion) => void) | undefined
  private answerHandler: ((a: IncomingAnswer) => void) | undefined

  constructor(private opts: RelayClientOptions) {
    this.key = deriveRoomKey(opts.token, opts.room)
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.opts.url)
      this.ws = ws
      this.joinWaiter = { resolve, reject }
      ws.addEventListener('open', () =>
        this.send({ kind: 'join', resumeToken: this.resumeToken, body: { room: this.opts.room, token: this.opts.token, name: this.opts.name } }))
      ws.addEventListener('message', (ev) => this.dispatch(parseEnvelope(String(ev.data))))
      ws.addEventListener('error', () => reject(new Error('websocket error')))
    })
  }

  private send(e: Partial<Envelope> & Pick<Envelope, 'kind'>): void {
    this.ws!.send(serialize({ v: 1, id: newMsgId(), ts: Date.now(), ...e } as Envelope))
  }

  private dispatch(env: Envelope): void {
    switch (env.kind) {
      case 'joined':
        this.peerId = env.from
        this.resumeToken = env.resumeToken
        this.joinWaiter?.resolve()
        this.joinWaiter = undefined
        return
      case 'ack': {
        const w = env.qid ? this.ackWaiters.get(env.qid) : undefined
        if (!w || !env.qid) return
        this.ackWaiters.delete(env.qid)
        const outcome = (env.body as { outcome?: { status?: string; error?: string } })?.outcome
        if (outcome?.error) w.reject(new Error(outcome.error)); else w.resolve()
        return
      }
      case 'peers_result':
        this.peersWaiters.shift()?.((env.body as { peers: PeerSummary[] }).peers)
        return
      case 'question':
        this.questionHandler?.({ from: env.from!, qid: env.qid!, question: open(this.key, env.body as { ciphertext: string; nonce: string }) })
        return
      case 'answer':
        this.answerHandler?.({ from: env.from!, qid: env.qid!, answer: open(this.key, env.body as { ciphertext: string; nonce: string }) })
        return
    }
  }

  ask(toPeerId: string, question: string): Promise<string> {
    const qid = newQid()
    const body = seal(this.key, question)
    return new Promise<string>((resolve, reject) => {
      this.ackWaiters.set(qid, { resolve: () => resolve(qid), reject })
      this.send({ kind: 'question', to: toPeerId, qid, body })
    })
  }

  answer(toPeerId: string, qid: string, text: string): Promise<void> {
    const body = seal(this.key, text)
    return new Promise<void>((resolve, reject) => {
      this.ackWaiters.set(qid, { resolve, reject })
      this.send({ kind: 'answer', to: toPeerId, qid, body })
    })
  }

  peers(): Promise<PeerSummary[]> {
    return new Promise((resolve) => { this.peersWaiters.push(resolve); this.send({ kind: 'peers' }) })
  }

  onQuestion(handler: (q: IncomingQuestion) => void): void { this.questionHandler = handler }
  onAnswer(handler: (a: IncomingAnswer) => void): void { this.answerHandler = handler }

  close(): void { this.ws?.close() }
}
```

- [ ] **Step 5: Run the connect test, expect PASS**

Run: `bun test test/relayClient.integration.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add src/relayClient.ts test/relayClient.integration.test.ts
git commit -m "feat: RelayClient connect/join against the live relay"
```

---

## Task 3: ask delivers an E2E-encrypted question

**Files:**
- Test: `vibegroup/test/relayClient.integration.test.ts` (append)

The implementation already exists from Task 2; this task proves the ask/onQuestion path E2E. (If Task 2 were split per strict TDD, `ask`/the `question` dispatch case would be added here — they are shown complete in Task 2.)

- [ ] **Step 1: Append the failing-then-passing behavior test**

Append to `vibegroup/test/relayClient.integration.test.ts`:

```ts
test('ask delivers an encrypted question the peer decrypts', async () => {
  const { url, room, token } = await setup()
  const alice = new RelayClient({ url, room, token, name: 'alice' })
  const bob = new RelayClient({ url, room, token, name: 'bob' })
  await alice.connect()
  await bob.connect()

  const got = new Promise<{ from: string; qid: string; question: string }>((r) => bob.onQuestion(r))
  const qid = await alice.ask(bob.peerId!, 'what branch are you on?')
  const q = await got

  expect(q.question).toBe('what branch are you on?')   // decrypted on the peer
  expect(q.qid).toBe(qid)
  expect(q.from).toBe(alice.peerId)
  alice.close(); bob.close()
})
```

- [ ] **Step 2: Run it, expect PASS**

Run: `bun test test/relayClient.integration.test.ts`
Expected: PASS (2 tests). If it fails, debug `ask`/the `question` dispatch case in `relayClient.ts` — do not weaken the assertion.

- [ ] **Step 3: Commit**

```bash
git add test/relayClient.integration.test.ts
git commit -m "test: ask delivers an E2E-encrypted question"
```

---

## Task 4: full ask→answer round trip + peers

**Files:**
- Test: `vibegroup/test/relayClient.integration.test.ts` (append)

- [ ] **Step 1: Append the round-trip and peers tests**

Append to `vibegroup/test/relayClient.integration.test.ts`:

```ts
test('full encrypted ask -> answer round trip', async () => {
  const { url, room, token } = await setup()
  const alice = new RelayClient({ url, room, token, name: 'alice' })
  const bob = new RelayClient({ url, room, token, name: 'bob' })
  await alice.connect()
  await bob.connect()

  bob.onQuestion(async (q) => { await bob.answer(q.from, q.qid, `answering: ${q.question}`) })
  const gotAnswer = new Promise<{ from: string; qid: string; answer: string }>((r) => alice.onAnswer(r))

  const qid = await alice.ask(bob.peerId!, 'did you finish the importer?')
  const a = await gotAnswer

  expect(a.qid).toBe(qid)
  expect(a.from).toBe(bob.peerId)
  expect(a.answer).toBe('answering: did you finish the importer?')
  alice.close(); bob.close()
})

test('peers lists the room members', async () => {
  const { url, room, token } = await setup()
  const alice = new RelayClient({ url, room, token, name: 'alice' })
  const bob = new RelayClient({ url, room, token, name: 'bob' })
  await alice.connect()
  await bob.connect()

  const names = (await alice.peers()).map((p) => p.name).sort()
  expect(names).toEqual(['alice', 'bob'])
  alice.close(); bob.close()
})
```

- [ ] **Step 2: Run the full agent suite, expect PASS**

Run: `bun test`
Expected: PASS — crypto (4) + relayClient integration (4) = 8 tests, output pristine.

- [ ] **Step 3: Commit**

```bash
git add test/relayClient.integration.test.ts
git commit -m "test: full E2E ask/answer round trip and peer listing"
```

---

## Self-Review

**Spec coverage (rev-2 §3.2 relay-client + E2E rows):**
- Relay client (one outbound WSS; join/peers/ask/answer) → Tasks 2–4. ✅
- Per-room E2E (key from room token; relay routes ciphertext) → Task 1 crypto, applied in `ask`/`answer`/dispatch. ✅
- Non-blocking `ask` returning a qid → `ask` resolves on the routing ack with the qid (Task 2 impl, proven Task 3). ✅
- Cross-implementation contract check → integration tests run the real `@vibegroup/relay`. ✅

**Deferred to M2b/M2c (noted, not silently dropped):** auto-reconnect with `resumeToken` after an unexpected drop; the `vibegroup_inbox` retrieval surface + inbox-nudge hook (asker-side answer collection in a real session); the read-only `claude -p` responder; the MCP server + slash commands + plugin packaging; presence `busy` transitions. These are the M2b/M2c plans.

**Placeholder scan:** none — every step has runnable code or an exact command.

**Type consistency:** `RelayClientOptions`, `PeerSummary`, `IncomingQuestion`, `IncomingAnswer`, and the `EncBody`-shaped `seal`/`open` match across tasks; `ask`/`answer` correlate acks by `qid` consistently with the relay's `ack` envelope.

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-06-21-vibegroup-agent-relayclient.md`. Continuing with **Inline Execution** (as chosen for M1).
