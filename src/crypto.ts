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
