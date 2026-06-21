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
