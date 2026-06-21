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
  const reg = upsertRoom(emptyRegistry(), 'pascal', entry('/proj/pascal'))
  expect(parseRegistry(serializeRegistry(reg))).toEqual(reg)
})

test('upsert/remove/setEnabled are pure and do not mutate the input', () => {
  const reg0 = emptyRegistry()
  const reg1 = upsertRoom(reg0, 'pascal', entry('/proj/pascal'))
  expect(reg0).toEqual(emptyRegistry())            // untouched
  expect(Object.keys(reg1.rooms)).toEqual(['pascal'])

  const reg2 = upsertRoom(reg1, 'yavendio', entry('/proj/yavendio'))
  expect(Object.keys(reg2.rooms).sort()).toEqual(['pascal', 'yavendio'])

  const reg3 = setEnabled(reg2, 'pascal', false)
  expect(reg3.rooms.pascal.enabled).toBe(false)
  expect(reg2.rooms.pascal.enabled).toBeUndefined()  // original untouched

  const reg4 = removeRoom(reg3, 'pascal')
  expect(Object.keys(reg4.rooms)).toEqual(['yavendio'])
})

test('setEnabled on an unknown label is a no-op', () => {
  const reg = upsertRoom(emptyRegistry(), 'pascal', entry('/proj/pascal'))
  expect(setEnabled(reg, 'ghost', false)).toEqual(reg)
})

function twoRooms(): RoomRegistry {
  let reg = emptyRegistry()
  reg = upsertRoom(reg, 'pascal', entry('/home/me/proj/pascal'))
  reg = upsertRoom(reg, 'yavendio', entry('/home/me/proj/yavendio'))
  return reg
}

test('activeRoomFor matches the bound dir and any subdirectory', () => {
  const reg = twoRooms()
  expect(activeRoomFor(reg, '/home/me/proj/pascal')?.label).toBe('pascal')
  expect(activeRoomFor(reg, '/home/me/proj/pascal/src/lib')?.label).toBe('pascal')
  expect(activeRoomFor(reg, '/home/me/proj/yavendio')?.label).toBe('yavendio')
})

test('activeRoomFor returns null outside every bound dir', () => {
  expect(activeRoomFor(twoRooms(), '/home/me/proj/other')).toBeNull()
  expect(activeRoomFor(twoRooms(), '/tmp')).toBeNull()
})

test('activeRoomFor picks the most specific room for nested checkouts', () => {
  let reg = emptyRegistry()
  reg = upsertRoom(reg, 'mono', entry('/home/me/proj'))
  reg = upsertRoom(reg, 'pascal', entry('/home/me/proj/pascal'))
  expect(activeRoomFor(reg, '/home/me/proj/pascal/src')?.label).toBe('pascal')  // longest wins
  expect(activeRoomFor(reg, '/home/me/proj/elsewhere')?.label).toBe('mono')
})

test('activeRoomFor skips disabled rooms', () => {
  const reg = setEnabled(twoRooms(), 'pascal', false)
  expect(activeRoomFor(reg, '/home/me/proj/pascal/src')).toBeNull()
})

test('activeRoomFor normalises messy paths', () => {
  const reg = twoRooms()
  expect(activeRoomFor(reg, '/home/me/proj/pascal/')?.label).toBe('pascal')
  expect(activeRoomFor(reg, '/home/me/proj/pascal/./src/..')?.label).toBe('pascal')
})

test('listRooms reports labels with their enabled state', () => {
  const reg = setEnabled(twoRooms(), 'yavendio', false)
  const got = listRooms(reg).map((r) => ({ label: r.label, enabled: r.enabled })).sort((a, b) => a.label.localeCompare(b.label))
  expect(got).toEqual([{ label: 'pascal', enabled: true }, { label: 'yavendio', enabled: false }])
})
