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
