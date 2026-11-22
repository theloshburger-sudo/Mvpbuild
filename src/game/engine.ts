import { QUESTIONS, type Question } from './questions.ts'

export type Phase = 'lobby' | 'answering' | 'voting' | 'reveal' | 'final'

export const TRUTH_POINTS = 2
export const FOOL_POINTS = 1
export const MAX_NAME = 14
export const MAX_ANSWER = 80
export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 8

interface Player {
  pid: string
  name: string
  score: number
  connected: boolean
}

interface Option {
  id: string
  text: string
  owners: string[] // pids who wrote it; empty for the truth
  isTruth: boolean
}

interface Round {
  q: Question
  fakes: Map<string, string>
  options: Option[]
  votes: Map<string, string>
  gains: Map<string, number>
}

export interface PlayerView {
  pid: string
  name: string
  score: number
  connected: boolean
  done: boolean // has answered (answering) / voted (voting)
}

export interface RevealRow {
  id: string
  text: string
  isTruth: boolean
  authors: string[]
  voters: string[]
}

export interface View {
  code: string
  phase: Phase
  me: string
  hostPid: string
  players: PlayerView[]
  roundNo: number
  totalRounds: number
  prompt?: string
  options?: { id: string; text: string }[]
  myOptions?: string[]
  myVote?: string
  iAnswered?: boolean
  myAnswer?: string
  reveal?: { truth: string; rows: RevealRow[]; gains: Record<string, number> }
}

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export class Game {
  readonly code: string
  readonly hostPid: string
  phase: Phase = 'lobby'
  totalRounds = 8
  private players: Player[] = []
  private roundNo = 0
  private deck: Question[] = []
  private cur?: Round
  private rng: () => number

  constructor(code: string, hostPid: string, rng: () => number = Math.random) {
    this.code = code
    this.hostPid = hostPid
    this.rng = rng
  }

  private get(pid: string) {
    return this.players.find((p) => p.pid === pid)
  }

  private active() {
    return this.players.filter((p) => p.connected)
  }

  join(pid: string, rawName: string): string | null {
    const existing = this.get(pid)
    if (existing) {
      existing.connected = true
      return null
    }
    if (this.phase !== 'lobby') return 'That game has already started.'
    if (this.players.length >= MAX_PLAYERS) return 'That room is full.'
    const name = rawName.trim().slice(0, MAX_NAME)
    if (!name) return 'Enter a name first.'
    if (this.players.some((p) => normalize(p.name) === normalize(name))) {
      return 'Someone already has that name.'
    }
    this.players.push({ pid, name, score: 0, connected: true })
    return null
  }

  setConnected(pid: string, connected: boolean) {
    const p = this.get(pid)
    if (!p) return
    if (this.phase === 'lobby' && !connected && pid !== this.hostPid) {
      this.players = this.players.filter((x) => x.pid !== pid)
      return
    }
    p.connected = connected
    this.checkProgress()
  }

  setRounds(n: number) {
    if (this.phase === 'lobby' && [5, 8, 12].includes(n)) this.totalRounds = n
  }

  start(): string | null {
    if (this.phase !== 'lobby' && this.phase !== 'final') return 'Already running.'
    if (this.active().length < MIN_PLAYERS) return `Need at least ${MIN_PLAYERS} players.`
    for (const p of this.players) p.score = 0
    this.roundNo = 0
    this.deck = shuffle(QUESTIONS, this.rng)
    this.beginRound()
    return null
  }

  private beginRound() {
    this.roundNo += 1
    const q = this.deck.pop() ?? shuffle(QUESTIONS, this.rng)[0]
    this.cur = { q, fakes: new Map(), options: [], votes: new Map(), gains: new Map() }
    this.phase = 'answering'
  }

  submitAnswer(pid: string, raw: string): string | null {
    const r = this.cur
    if (this.phase !== 'answering' || !r || !this.get(pid)) return 'Not accepting answers right now.'
    const text = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_ANSWER)
    if (!text) return 'Write something first.'
    if (normalize(text) === normalize(r.q.answer)) {
      return "That's too close to the truth. Try something else."
    }
    r.fakes.set(pid, text)
    this.checkProgress()
    return null
  }

  vote(pid: string, optionId: string): string | null {
    const r = this.cur
    if (this.phase !== 'voting' || !r || !this.get(pid)) return 'Not accepting votes right now.'
    const opt = r.options.find((o) => o.id === optionId)
    if (!opt) return 'Pick one of the answers.'
    if (opt.owners.includes(pid)) return "You can't vote for your own answer."
    r.votes.set(pid, optionId)
    this.checkProgress()
    return null
  }

  /** Host can push the game forward without waiting on stragglers. */
  advance(): string | null {
    if (this.phase === 'answering') {
      if (this.cur && this.cur.fakes.size === 0) return 'Nobody has answered yet.'
      this.toVoting()
    } else if (this.phase === 'voting') {
      this.toReveal()
    } else if (this.phase === 'reveal') {
      if (this.roundNo >= this.totalRounds) this.phase = 'final'
      else this.beginRound()
    } else {
      return 'Nothing to advance.'
    }
    return null
  }

  backToLobby() {
    this.phase = 'lobby'
    this.cur = undefined
    this.players = this.players.filter((p) => p.connected)
    for (const p of this.players) p.score = 0
  }

  private checkProgress() {
    const r = this.cur
    if (!r) return
    if (this.phase === 'answering') {
      const act = this.active()
      if (act.length > 0 && act.every((p) => r.fakes.has(p.pid))) this.toVoting()
    } else if (this.phase === 'voting') {
      const act = this.active()
      if (act.length > 0 && act.every((p) => r.votes.has(p.pid))) this.toReveal()
    }
  }

  private toVoting() {
    const r = this.cur!
    const grouped = new Map<string, Option>()
    for (const [pid, text] of r.fakes) {
      const key = normalize(text)
      const hit = grouped.get(key)
      if (hit) hit.owners.push(pid)
      else grouped.set(key, { id: '', text, owners: [pid], isTruth: false })
    }
    const all = [...grouped.values(), { id: '', text: r.q.answer, owners: [], isTruth: true }]
    r.options = shuffle(all, this.rng).map((o, i) => ({ ...o, id: `o${i}` }))
    this.phase = 'voting'
    this.checkProgress()
  }

  private toReveal() {
    const r = this.cur!
    for (const [voter, optId] of r.votes) {
      const opt = r.options.find((o) => o.id === optId)
      if (!opt) continue
      if (opt.isTruth) r.gains.set(voter, (r.gains.get(voter) ?? 0) + TRUTH_POINTS)
      else for (const owner of opt.owners) r.gains.set(owner, (r.gains.get(owner) ?? 0) + FOOL_POINTS)
    }
    for (const [pid, g] of r.gains) {
      const p = this.get(pid)
      if (p) p.score += g
    }
    this.phase = 'reveal'
  }

  view(me: string): View {
    const r = this.cur
    const v: View = {
      code: this.code,
      phase: this.phase,
      me,
      hostPid: this.hostPid,
      roundNo: this.roundNo,
      totalRounds: this.totalRounds,
      players: this.players.map((p) => ({
        pid: p.pid,
        name: p.name,
        score: p.score,
        connected: p.connected,
        done:
          this.phase === 'answering'
            ? !!r?.fakes.has(p.pid)
            : this.phase === 'voting'
              ? !!r?.votes.has(p.pid)
              : false,
      })),
    }
    if (!r || this.phase === 'lobby' || this.phase === 'final') return v
    v.prompt = r.q.prompt
    if (this.phase === 'answering') {
      v.iAnswered = r.fakes.has(me)
      v.myAnswer = r.fakes.get(me)
    } else {
      v.options = r.options.map((o) => ({ id: o.id, text: o.text }))
      v.myOptions = r.options.filter((o) => o.owners.includes(me)).map((o) => o.id)
      v.myVote = r.votes.get(me)
    }
    if (this.phase === 'reveal') {
      const name = (pid: string) => this.get(pid)?.name ?? '?'
      v.reveal = {
        truth: r.q.answer,
        rows: r.options.map((o) => ({
          id: o.id,
          text: o.text,
          isTruth: o.isTruth,
          authors: o.owners.map(name),
          voters: [...r.votes].filter(([, id]) => id === o.id).map(([pid]) => name(pid)),
        })),
        gains: Object.fromEntries(r.gains),
      }
    }
    return v
  }
}
