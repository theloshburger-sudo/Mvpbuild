import { useCallback, useEffect, useRef, useState } from 'react'
import { Game, type View } from './engine.ts'
import {
  openClient,
  openHost,
  isMemoryNet,
  type ClientNet,
  type ClientMsg,
  type HostNet,
} from './net.ts'

export type Status = 'idle' | 'connecting' | 'online' | 'reconnecting'
type Role = 'host' | 'client'

const store = () => (isMemoryNet() ? sessionStorage : localStorage)
const read = (k: string) => {
  try {
    return store().getItem(k)
  } catch {
    return null
  }
}
const write = (k: string, v: string | null) => {
  try {
    if (v === null) store().removeItem(k)
    else store().setItem(k, v)
  } catch {
    /* private mode etc. */
  }
}

function getPid() {
  let pid = read('psych.pid')
  if (!pid) {
    pid = crypto.randomUUID()
    write('psych.pid', pid)
  }
  return pid
}

export function useSession() {
  const [view, setView] = useState<View | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  const role = useRef<Role | null>(null)
  const pid = useRef(getPid())
  const game = useRef<Game | null>(null)
  const hostNet = useRef<HostNet | null>(null)
  const clientNet = useRef<ClientNet | null>(null)
  const conns = useRef(new Map<string, string>()) // connection id -> pid
  const last = useRef<{ code: string; name: string } | null>(null)
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resumed = useRef(false)

  // ---------- host ----------

  const publish = useCallback(() => {
    const g = game.current
    if (!g) return
    setView(g.view(pid.current))
    for (const [conn, p] of conns.current) hostNet.current?.send(conn, { t: 'view', view: g.view(p) })
  }, [])

  const createRoom = useCallback(
    async (name: string) => {
      setError(null)
      setStatus('connecting')
      try {
        const net = await openHost({
          onOpen: () => {},
          onClose: (conn) => {
            const p = conns.current.get(conn)
            conns.current.delete(conn)
            // A fresh connection for the same player may already have replaced this one.
            if (p && ![...conns.current.values()].includes(p)) {
              game.current?.setConnected(p, false)
              publish()
            }
          },
          onMsg: (conn, msg: ClientMsg) => {
            const g = game.current
            if (!g) return
            let err: string | null = null
            if (msg.t === 'join') {
              err = g.join(msg.pid, msg.name)
              if (!err) conns.current.set(conn, msg.pid)
            } else {
              const p = conns.current.get(conn)
              if (!p) return
              err = msg.t === 'answer' ? g.submitAnswer(p, msg.text) : g.vote(p, msg.option)
            }
            if (err) hostNet.current?.send(conn, { t: 'error', msg: err })
            publish()
          },
        })
        hostNet.current = net
        role.current = 'host'
        const g = new Game(net.code, pid.current)
        g.join(pid.current, name)
        game.current = g
        setStatus('online')
        publish()
      } catch (e) {
        setStatus('idle')
        setError((e as Error).message || "Couldn't create a room.")
      }
    },
    [publish],
  )

  // ---------- client ----------

  const connect = useCallback(async function connect(code: string, name: string) {
    clientNet.current?.close()
    const net = await openClient(code, {
      onMsg: (m) => {
        if (m.t === 'view') {
          setView(m.view)
          setError(null)
        } else setError(m.msg)
      },
      onClose: () => {
        clientNet.current = null
        setStatus('reconnecting')
        const tryAgain = async () => {
          if (!last.current) return
          try {
            await connect(last.current.code, last.current.name)
          } catch {
            retry.current = setTimeout(tryAgain, 2000)
          }
        }
        retry.current = setTimeout(tryAgain, 1500)
      },
    })
    clientNet.current = net
    net.send({ t: 'join', pid: pid.current, name })
    setStatus('online')
  }, [])

  const joinRoom = useCallback(
    async (rawCode: string, name: string) => {
      const code = rawCode.trim().toUpperCase()
      setError(null)
      setStatus('connecting')
      try {
        await connect(code, name)
        role.current = 'client'
        last.current = { code, name }
        write('psych.last', JSON.stringify({ code, name }))
      } catch (e) {
        setStatus('idle')
        setError((e as Error).message)
        write('psych.last', null)
      }
    },
    [connect],
  )

  // Rejoin after a refresh or the phone's browser being killed in the background.
  useEffect(() => {
    if (resumed.current) return
    resumed.current = true
    const raw = read('psych.last')
    if (!raw) return
    try {
      const { code, name } = JSON.parse(raw) as { code: string; name: string }
      void Promise.resolve().then(() => joinRoom(code, name))
    } catch {
      write('psych.last', null)
    }
  }, [joinRoom])

  // ---------- actions ----------

  const send = useCallback(
    (msg: ClientMsg) => {
      setError(null)
      const g = game.current
      if (role.current === 'host' && g) {
        const err = msg.t === 'answer' ? g.submitAnswer(pid.current, msg.text) : msg.t === 'vote' ? g.vote(pid.current, msg.option) : null
        if (err) setError(err)
        publish()
      } else clientNet.current?.send(msg)
    },
    [publish],
  )

  const hostDo = useCallback(
    (fn: (g: Game) => string | null | void) => {
      const g = game.current
      if (!g) return
      const err = fn(g)
      setError(err ?? null)
      publish()
    },
    [publish],
  )

  const leave = useCallback(() => {
    if (retry.current) clearTimeout(retry.current)
    hostNet.current?.close()
    clientNet.current?.close()
    hostNet.current = clientNet.current = null
    game.current = null
    conns.current.clear()
    last.current = null
    role.current = null
    write('psych.last', null)
    setView(null)
    setStatus('idle')
    setError(null)
  }, [])

  return {
    view,
    status,
    error,
    createRoom,
    joinRoom,
    leave,
    answer: (text: string) => send({ t: 'answer', text }),
    vote: (option: string) => send({ t: 'vote', option }),
    start: () => hostDo((g) => g.start()),
    advance: () => hostDo((g) => g.advance()),
    setRounds: (n: number) => hostDo((g) => g.setRounds(n)),
    playAgain: () => hostDo((g) => g.backToLobby()),
  }
}
