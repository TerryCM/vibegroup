import { join, resolve, relative, isAbsolute } from 'path'

// A single joined room: its relay creds plus the project directory it is bound to.
// Creds live here (centralised) instead of being inlined as env vars in every
// repo's .mcp.json, so one machine can hold many rooms without duplicating tokens.
export interface RoomEntry {
  url: string
  room: string
  token: string
  name: string
  dir: string             // absolute path this room is scoped to
  enabled?: boolean       // on/off toggle; treated as true when omitted
}

// The whole registry, keyed by a short human label (e.g. "pascal", "yavendio").
export interface RoomRegistry {
  rooms: Record<string, RoomEntry>
}

export interface ActiveRoom {
  label: string
  entry: RoomEntry
}

export function registryPath(home: string): string {
  return join(home, '.claude', 'vibegroup', 'rooms.json')
}

export function emptyRegistry(): RoomRegistry {
  return { rooms: {} }
}

// Tolerant load: missing/invalid/legacy shapes collapse to an empty registry
// rather than throwing, so a corrupt file never bricks a session.
export function parseRegistry(raw: string | null | undefined): RoomRegistry {
  if (!raw) return emptyRegistry()
  try {
    const data = JSON.parse(raw) as { rooms?: unknown }
    if (!data || typeof data.rooms !== 'object' || data.rooms === null) return emptyRegistry()
    return { rooms: data.rooms as Record<string, RoomEntry> }
  } catch {
    return emptyRegistry()
  }
}

export function serializeRegistry(reg: RoomRegistry): string {
  return JSON.stringify(reg, null, 2) + '\n'
}

// --- pure CRUD: each returns a new registry, never mutates the input ---

export function upsertRoom(reg: RoomRegistry, label: string, entry: RoomEntry): RoomRegistry {
  return { rooms: { ...reg.rooms, [label]: entry } }
}

export function removeRoom(reg: RoomRegistry, label: string): RoomRegistry {
  const { [label]: _removed, ...rest } = reg.rooms
  return { rooms: rest }
}

export function setEnabled(reg: RoomRegistry, label: string, enabled: boolean): RoomRegistry {
  const entry = reg.rooms[label]
  if (!entry) return reg
  return upsertRoom(reg, label, { ...entry, enabled })
}

// True when `cwd` is the bound dir or sits inside it.
function within(dir: string, cwd: string): boolean {
  const rel = relative(resolve(dir), resolve(cwd))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

// Resolve which room is active for a working directory: among enabled rooms whose
// dir contains `cwd`, the most specific (longest bound dir) wins. This is what makes
// "/pascal → only the pascal room" work, including nested checkouts.
export function activeRoomFor(reg: RoomRegistry, cwd: string): ActiveRoom | null {
  let best: ActiveRoom | null = null
  for (const [label, entry] of Object.entries(reg.rooms)) {
    if (entry.enabled === false) continue
    if (!within(entry.dir, cwd)) continue
    if (!best || resolve(entry.dir).length > resolve(best.entry.dir).length) best = { label, entry }
  }
  return best
}

export function listRooms(reg: RoomRegistry): (ActiveRoom & { enabled: boolean })[] {
  return Object.entries(reg.rooms).map(([label, entry]) => ({ label, entry, enabled: entry.enabled !== false }))
}
