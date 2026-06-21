import { redactSecrets } from './redact'
import type { RelayClient } from './relayClient'

export interface AnswerEngine {
  answer(question: string, opts: { cwd: string }): Promise<string>
}

export interface ResponderOptions {
  engine: AnswerEngine
  cwd: string
  maxAnswerChars?: number
}

export interface Responder {
  handle(question: string): Promise<string>
}

const DECLINE = 'vibegroup responder could not answer that from available context.'

export function createResponder(opts: ResponderOptions): Responder {
  const max = opts.maxAnswerChars ?? 4000
  return {
    async handle(question) {
      let raw: string
      try {
        raw = await opts.engine.answer(question, { cwd: opts.cwd })
      } catch {
        return DECLINE
      }
      return redactSecrets(raw, max)
    },
  }
}

export function attachResponder(client: RelayClient, responder: Responder): void {
  client.onQuestion(async ({ from, qid, question }) => {
    const text = await responder.handle(question)
    await client.answer(from, qid, text)
  })
}
