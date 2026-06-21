import { randomBytes } from 'node:crypto'

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString('hex')}`
}
export const newPeerId = () => newId('p')
export const newQid = () => newId('q')
export const newMsgId = () => newId('m')
