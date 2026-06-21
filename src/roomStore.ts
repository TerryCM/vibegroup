import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import {
  registryPath, parseRegistry, serializeRegistry, activeRoomFor,
  type RoomRegistry, type ActiveRoom,
} from './roomRegistry'

// I/O layer over the pure registry: read/write ~/.claude/vibegroup/rooms.json.

export function loadRegistry(home: string): RoomRegistry {
  const path = registryPath(home)
  try {
    return existsSync(path) ? parseRegistry(readFileSync(path, 'utf8')) : parseRegistry(null)
  } catch {
    return parseRegistry(null)
  }
}

export function saveRegistry(home: string, reg: RoomRegistry): string {
  const path = registryPath(home)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, serializeRegistry(reg))
  return path
}

// The room a session in `cwd` should join — or null when this directory has no
// enabled room (vibegroup is simply off here).
export function resolveActiveRoom(home: string, cwd: string): ActiveRoom | null {
  return activeRoomFor(loadRegistry(home), cwd)
}
