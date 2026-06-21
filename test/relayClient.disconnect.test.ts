import { test, expect, afterEach } from 'bun:test'
import { RelayClient } from '../src/relayClient'

// A relay that completes the join handshake but never answers anything else,
// so any peers()/ask() stays in-flight until we drop the socket.
let server: ReturnType<typeof Bun.serve> | undefined
afterEach(() => { server?.stop(true); server = undefined })

function silentRelay() {
  server = Bun.serve({
    port: 0,
    fetch(req, srv) { return srv.upgrade(req) ? undefined : new Response('no', { status: 400 }) },
    websocket: {
      message(ws, raw) {
        const env = JSON.parse(String(raw)) as { kind: string }
        if (env.kind === 'join') {
          ws.send(JSON.stringify({
            v: 1, kind: 'joined', id: 'm_1', ts: 0, from: 'p_self', resumeToken: 'p_self.sig', body: { peers: [] },
          }))
        }
        // every other kind (peers, question, answer) is deliberately ignored
      },
    },
  })
  return `ws://localhost:${server.port}`
}

test('in-flight peers()/ask() settle (do not hang) when the socket drops', async () => {
  const c = new RelayClient({ url: silentRelay(), room: 'r', token: 't', name: 'x' })
  await c.connect()

  const pendingPeers = c.peers()              // never answered by the silent relay
  const pendingAsk = c.ask('p_other', 'q?')   // never acked either
  c.close()                                   // drop the socket

  await expect(pendingPeers).resolves.toEqual([])   // resolves empty instead of hanging
  await expect(pendingAsk).rejects.toThrow(/closed/) // rejects instead of hanging
}, 3000)
