import { test, expect, afterEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { loadRegistry, saveRegistry, resolveActiveRoom } from '../src/roomStore'
import { emptyRegistry, upsertRoom, setEnabled, type RoomEntry } from '../src/roomRegistry'

const entry = (dir: string): RoomEntry => ({ url: 'wss://relay/ws', room: 'rm_x', token: 'tok', name: 'me', dir })

let homes: string[] = []
function freshHome(): string {
  const h = mkdtempSync(join(tmpdir(), 'vg-home-'))
  homes.push(h)
  return h
}
afterEach(() => { homes.forEach((h) => rmSync(h, { recursive: true, force: true })); homes = [] })

test('loadRegistry on a missing file returns an empty registry', () => {
  expect(loadRegistry(freshHome())).toEqual(emptyRegistry())
})

test('saveRegistry then loadRegistry round trips through disk', () => {
  const home = freshHome()
  let reg = upsertRoom(emptyRegistry(), 'myteam', entry('/home/me/code/myteam'))
  reg = upsertRoom(reg, 'backend', entry('/home/me/code/backend'))
  saveRegistry(home, reg)
  expect(loadRegistry(home)).toEqual(reg)
})

test('resolveActiveRoom picks the room bound to the cwd', () => {
  const home = freshHome()
  let reg = upsertRoom(emptyRegistry(), 'myteam', entry('/home/me/code/myteam'))
  reg = upsertRoom(reg, 'backend', entry('/home/me/code/backend'))
  saveRegistry(home, reg)

  expect(resolveActiveRoom(home, '/home/me/code/myteam/src')?.label).toBe('myteam')
  expect(resolveActiveRoom(home, '/home/me/code/backend')?.label).toBe('backend')
  expect(resolveActiveRoom(home, '/home/me/code/other')).toBeNull()
})

test('resolveActiveRoom returns null for a disabled room', () => {
  const home = freshHome()
  const reg = setEnabled(upsertRoom(emptyRegistry(), 'myteam', entry('/home/me/code/myteam')), 'myteam', false)
  saveRegistry(home, reg)
  expect(resolveActiveRoom(home, '/home/me/code/myteam')).toBeNull()
})
