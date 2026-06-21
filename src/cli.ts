import { AgentSession } from './agentSession'
import { claudeAnswerEngine } from './responder'

export interface CliArgs { room: string; url: string; token: string; name: string; model?: string }

export function parseArgs(argv: string[], env: Record<string, string | undefined>): CliArgs {
  if (argv[0] !== 'join' || !argv[1]) throw new Error('usage: vibegroup join <room> [--token t] [--name n] [--relay url] [--model m]')
  const room = argv[1]
  const flag = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }
  const url = flag('--relay') ?? env.VIBEGROUP_RELAY_URL
  const token = flag('--token') ?? env.VIBEGROUP_TOKEN
  const name = flag('--name') ?? env.VIBEGROUP_NAME ?? 'vibegroup-agent'
  const model = flag('--model') ?? env.VIBEGROUP_MODEL
  if (!url) throw new Error('missing relay url (--relay or VIBEGROUP_RELAY_URL)')
  if (!token) throw new Error('missing token (--token or VIBEGROUP_TOKEN)')
  return { room, url, token, name, model }
}

export async function main(argv: string[], env: Record<string, string | undefined>): Promise<AgentSession> {
  const a = parseArgs(argv, env)
  const session = new AgentSession({
    url: a.url, room: a.room, token: a.token, name: a.name,
    engine: claudeAnswerEngine({ cwd: process.cwd(), model: a.model }), cwd: process.cwd(),
  })
  const { peerId } = await session.join()
  console.log(`vibegroup: joined ${a.room} as ${a.name} (${peerId}); answering peer questions read-only.`)
  return session
}

if (import.meta.main) {
  main(process.argv.slice(2), process.env).catch((e) => { console.error(String(e?.message ?? e)); process.exit(1) })
}
