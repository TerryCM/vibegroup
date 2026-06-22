import { test, expect } from 'bun:test'
import {
  emptyRegistry, parseRegistry, serializeRegistry, registryPath,
  upsertRoom, removeRoom, setEnabled, activeRoomFor, listRooms,
  type RoomEntry, type RoomRegistry,
} from '../src/roomRegistry'

const entry = (dir: string, over: Partial<RoomEntry> = {}): RoomEntry => ({
  url: 'wss://relay/ws', room: 'rm_x', token: 'tok', name: 'me', dir, ...over,
})

test('registryPath lands under ~/.claude/vibegroup', () => {
  expect(registryPath('/home/me')).toBe('/home/me/.claude/vibegroup/rooms.json')
})

test('parseRegistry is tolerant of missing/invalid input', () => {
  expect(parseRegistry(null)).toEqual(emptyRegistry())
  expect(parseRegistry('not json')).toEqual(emptyRegistry())
  expect(parseRegistry('{"rooms": null}')).toEqual(emptyRegistry())
  expect(parseRegistry('{"nope": 1}')).toEqual(emptyRegistry())
})

test('serialize -> parse round trips', () => {
  const reg = upsertRoom(emptyRegistry(), 'myteam', entry('/code/myteam'))
  expect(parseRegistry(serializeRegistry(reg))).toEqual(reg)
})

test('upsert/remove/setEnabled are pure and do not mutate the input', () => {
  const reg0 = emptyRegistry()
  const reg1 = upsertRoom(reg0, 'myteam', entry('/code/myteam'))
  expect(reg0).toEqual(emptyRegistry())            // untouched
  expect(Object.keys(reg1.rooms)).toEqual(['myteam'])

  const reg2 = upsertRoom(reg1, 'backend', entry('/code/backend'))
  expect(Object.keys(reg2.rooms).sort()).toEqual(['backend', 'myteam'])

  const reg3 = setEnabled(reg2, 'myteam', false)
  expect(reg3.rooms.myteam.enabled).toBe(false)
  expect(reg2.rooms.myteam.enabled).toBeUndefined()  // original untouched

  const reg4 = removeRoom(reg3, 'myteam')
  expect(Object.keys(reg4.rooms)).toEqual(['backend'])
})

test('setEnabled on an unknown label is a no-op', () => {
  const reg = upsertRoom(emptyRegistry(), 'myteam', entry('/code/myteam'))
  expect(setEnabled(reg, 'ghost', false)).toEqual(reg)
})

function twoRooms(): RoomRegistry {
  let reg = emptyRegistry()
  reg = upsertRoom(reg, 'myteam', entry('/home/me/code/myteam'))
  reg = upsertRoom(reg, 'backend', entry('/home/me/code/backend'))
  return reg
}

test('activeRoomFor matches the bound dir and any subdirectory', () => {
  const reg = twoRooms()
  expect(activeRoomFor(reg, '/home/me/code/myteam')?.label).toBe('myteam')
  expect(activeRoomFor(reg, '/home/me/code/myteam/src/lib')?.label).toBe('myteam')
  expect(activeRoomFor(reg, '/home/me/code/backend')?.label).toBe('backend')
})

test('activeRoomFor returns null outside every bound dir', () => {
  expect(activeRoomFor(twoRooms(), '/home/me/code/other')).toBeNull()
  expect(activeRoomFor(twoRooms(), '/tmp')).toBeNull()
})

test('activeRoomFor picks the most specific room for nested checkouts', () => {
  let reg = emptyRegistry()
  reg = upsertRoom(reg, 'mono', entry('/home/me/code'))
  reg = upsertRoom(reg, 'myteam', entry('/home/me/code/myteam'))
  expect(activeRoomFor(reg, '/home/me/code/myteam/src')?.label).toBe('myteam')  // longest wins
  expect(activeRoomFor(reg, '/home/me/code/elsewhere')?.label).toBe('mono')
})

test('activeRoomFor skips disabled rooms', () => {
  const reg = setEnabled(twoRooms(), 'myteam', false)
  expect(activeRoomFor(reg, '/home/me/code/myteam/src')).toBeNull()
})

test('activeRoomFor normalises messy paths', () => {
  const reg = twoRooms()
  expect(activeRoomFor(reg, '/home/me/code/myteam/')?.label).toBe('myteam')
  expect(activeRoomFor(reg, '/home/me/code/myteam/./src/..')?.label).toBe('myteam')
})

test('listRooms reports labels with their enabled state', () => {
  const reg = setEnabled(twoRooms(), 'backend', false)
  const got = listRooms(reg).map((r) => ({ label: r.label, enabled: r.enabled })).sort((a, b) => a.label.localeCompare(b.label))
  expect(got).toEqual([{ label: 'backend', enabled: false }, { label: 'myteam', enabled: true }])
})
