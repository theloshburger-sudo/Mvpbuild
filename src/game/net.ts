import Peer, { type DataConnection } from 'peerjs'
import type { View } from './engine.ts'

export type ClientMsg =
  | { t: 'join'; pid: string; name: string }
  | { t: 'answer'; text: string }
  | { t: 'vote'; option: string }
  | { t: 'addCustom'; prompt: string; answer: string }
  | { t: 'removeCustom'; id: string }

export type ServerMsg = { t: 'view'; view: View } | { t: 'error'; msg: string }

export interface HostHandlers {
  onOpen(conn: string): void
  onMsg(conn: string, msg: ClientMsg): void
  onClose(conn: string): void
}
export interface HostNet {
  code: string
  send(conn: string, msg: ServerMsg): void
  close(): void
}
export interface ClientHandlers {
  onMsg(msg: ServerMsg): void
  onClose(): void
}
export interface ClientNet {
  send(msg: ClientMsg): void
  close(): void
}

// No I/O/0/1 so codes are easy to read aloud.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ'
const randomCode = () =>
  Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')

const peerId = (code: string) => `psych-${code}`

/** `?mem` swaps WebRTC for same-browser BroadcastChannel so you can test with several tabs. */
export const isMemoryNet = () => new URLSearchParams(location.search).has('mem')

// ---------- WebRTC (PeerJS) ----------

async function openPeerHost(h: HostHandlers): Promise<HostNet> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode()
    try {
      const peer = await new Promise<Peer>((resolve, reject) => {
        const p = new Peer(peerId(code))
        p.on('open', () => resolve(p))
        p.on('error', (e) => {
          p.destroy()
          reject(e)
        })
      })
      // Rejoining the matchmaking server keeps the room joinable; open games are unaffected.
      peer.on('disconnected', () => {
        if (!peer.destroyed) setTimeout(() => !peer.destroyed && peer.reconnect(), 1000)
      })
      const conns = new Map<string, DataConnection>()
      peer.on('connection', (c) => {
        c.on('open', () => {
          conns.set(c.peer, c)
          h.onOpen(c.peer)
        })
        c.on('data', (d) => h.onMsg(c.peer, d as ClientMsg))
        c.on('close', () => {
          if (conns.get(c.peer) === c) conns.delete(c.peer)
          h.onClose(c.peer)
        })
      })
      return {
        code,
        send: (conn, msg) => {
          const c = conns.get(conn)
          if (c?.open) c.send(msg)
        },
        close: () => peer.destroy(),
      }
    } catch (e) {
      if ((e as { type?: string }).type !== 'unavailable-id') {
        throw new Error("Couldn't reach the game server. Check your internet and try again.")
      }
    }
  }
  throw new Error('Could not reserve a room code. Try again.')
}

function openPeerClient(code: string, h: ClientHandlers): Promise<ClientNet> {
  return new Promise((resolve, reject) => {
    const peer = new Peer()
    let settled = false
    const fail = (msg: string) => {
      if (settled) return
      settled = true
      peer.destroy()
      reject(new Error(msg))
    }
    const timer = setTimeout(() => fail("Couldn't reach that room."), 10000)
    peer.on('error', (e) =>
      fail(e.type === 'peer-unavailable' ? 'No room with that code.' : "Couldn't connect. Check your signal."),
    )
    peer.on('open', () => {
      const conn = peer.connect(peerId(code), { reliable: true })
      conn.on('open', () => {
        clearTimeout(timer)
        settled = true
        resolve({ send: (m) => conn.open && conn.send(m), close: () => peer.destroy() })
      })
      conn.on('data', (d) => h.onMsg(d as ServerMsg))
      conn.on('close', () => {
        if (settled) h.onClose()
        else fail("Couldn't reach that room.")
      })
    })
  })
}

// ---------- BroadcastChannel (dev / test) ----------

interface Envelope {
  kind: 'hello' | 'bye' | 'data'
  from: string
  to: string
  body?: unknown
}

async function openMemHost(h: HostHandlers): Promise<HostNet> {
  const code = randomCode()
  const ch = new BroadcastChannel(`psych-mem-${code}`)
  ch.onmessage = (e: MessageEvent<Envelope>) => {
    const m = e.data
    if (m.to !== 'host') return
    if (m.kind === 'hello') h.onOpen(m.from)
    else if (m.kind === 'bye') h.onClose(m.from)
    else h.onMsg(m.from, m.body as ClientMsg)
  }
  return {
    code,
    send: (conn, msg) => ch.postMessage({ kind: 'data', from: 'host', to: conn, body: msg } satisfies Envelope),
    close: () => ch.close(),
  }
}

async function openMemClient(code: string, h: ClientHandlers): Promise<ClientNet> {
  const id = crypto.randomUUID()
  const ch = new BroadcastChannel(`psych-mem-${code}`)
  ch.onmessage = (e: MessageEvent<Envelope>) => {
    if (e.data.to === id) h.onMsg(e.data.body as ServerMsg)
  }
  const post = (kind: Envelope['kind'], body?: unknown) =>
    ch.postMessage({ kind, from: id, to: 'host', body } satisfies Envelope)
  addEventListener('pagehide', () => post('bye'))
  post('hello')
  return { send: (m) => post('data', m), close: () => ch.close() }
}

export const openHost = (h: HostHandlers) => (isMemoryNet() ? openMemHost(h) : openPeerHost(h))
export const openClient = (code: string, h: ClientHandlers) =>
  isMemoryNet() ? openMemClient(code, h) : openPeerClient(code, h)
