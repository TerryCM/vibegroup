import { z } from 'zod'

export const PROTOCOL_VERSION = 1 as const

export type Kind =
  | 'join' | 'joined' | 'peers' | 'peers_result' | 'presence'
  | 'question' | 'answer' | 'ack' | 'error' | 'ping' | 'pong'

export interface EncBody { ciphertext: string; nonce: string }

export interface Envelope {
  v: 1
  kind: Kind
  id: string
  ts: number
  seq?: number
  room?: string
  from?: string
  to?: string
  qid?: string
  resumeToken?: string
  body?: unknown
}

const KindSchema = z.enum([
  'join', 'joined', 'peers', 'peers_result', 'presence',
  'question', 'answer', 'ack', 'error', 'ping', 'pong',
])

const EnvelopeSchema = z.object({
  v: z.literal(PROTOCOL_VERSION),
  kind: KindSchema,
  id: z.string().min(1),
  ts: z.number(),
  seq: z.number().optional(),
  room: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  qid: z.string().optional(),
  resumeToken: z.string().optional(),
  body: z.unknown().optional(),
})

export function parseEnvelope(raw: string): Envelope {
  return EnvelopeSchema.parse(JSON.parse(raw)) as Envelope
}

export function serialize(e: Envelope): string {
  return JSON.stringify(e)
}
