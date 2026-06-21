import { basename, resolve } from 'path'
import { activeRoomFor, listRooms, type RoomRegistry } from './roomRegistry'

// Default a room's label to its folder name, so `vibegroup add` in /code/myteam
// becomes "myteam" without the user having to name it.
export function defaultLabel(dir: string): string {
  return basename(resolve(dir)) || 'room'
}

// Human-readable `vibegroup list`, marking the room active for the current cwd.
export function formatRoomList(reg: RoomRegistry, cwd: string): string {
  const rooms = listRooms(reg)
  if (rooms.length === 0) return 'no rooms yet — run: vibegroup add <label>'
  const active = activeRoomFor(reg, cwd)?.label
  return rooms
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((r) => {
      const mark = r.label === active ? '*' : ' '
      const state = r.enabled ? '' : '  (disabled)'
      return `${mark} ${r.label}  →  ${r.entry.dir}${state}\n      room ${r.entry.room}  ·  ${r.entry.url}`
    })
    .join('\n')
}

// `vibegroup show` — what's active right here.
export function formatActive(reg: RoomRegistry, cwd: string): string {
  const active = activeRoomFor(reg, cwd)
  if (!active) return 'no active room in this directory (run: vibegroup list)'
  return `active room: ${active.label}\n  dir:   ${active.entry.dir}\n  room:  ${active.entry.room}\n  name:  ${active.entry.name}\n  relay: ${active.entry.url}`
}
