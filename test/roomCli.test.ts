import { test, expect } from 'bun:test'
import { defaultLabel, formatRoomList, formatActive } from '../src/roomCli'
import { emptyRegistry, upsertRoom, setEnabled, type RoomEntry, type RoomRegistry } from '../src/roomRegistry'

const entry = (dir: string): RoomEntry => ({ url: 'wss://relay/ws', room: 'rm_x', token: 'tok', name: 'me', dir })

test('defaultLabel is the folder name', () => {
  expect(defaultLabel('/home/me/code/myteam')).toBe('myteam')
  expect(defaultLabel('/home/me/code/myteam/')).toBe('myteam')
})

function twoRooms(): RoomRegistry {
  let reg = emptyRegistry()
  reg = upsertRoom(reg, 'myteam', entry('/home/me/code/myteam'))
  reg = upsertRoom(reg, 'backend', entry('/home/me/code/backend'))
  return reg
}

test('formatRoomList marks the active room for the cwd', () => {
  const out = formatRoomList(twoRooms(), '/home/me/code/myteam/src')
  const lines = out.split('\n').filter((l) => l.includes('→'))
  expect(lines.find((l) => l.includes('myteam'))!.startsWith('*')).toBe(true)
  expect(lines.find((l) => l.includes('backend'))!.startsWith('*')).toBe(false)
})

test('formatRoomList shows disabled state and no active mark outside any dir', () => {
  const reg = setEnabled(twoRooms(), 'backend', false)
  const out = formatRoomList(reg, '/tmp')
  expect(out).toContain('backend')
  expect(out).toContain('(disabled)')
  expect(out.split('\n').some((l) => l.startsWith('*'))).toBe(false)
})

test('formatRoomList handles an empty registry', () => {
  expect(formatRoomList(emptyRegistry(), '/anywhere')).toContain('vibegroup add')
})

test('formatActive resolves the room for the cwd, or says none', () => {
  expect(formatActive(twoRooms(), '/home/me/code/myteam')).toContain('active room: myteam')
  expect(formatActive(twoRooms(), '/somewhere/else')).toContain('no active room')
})
