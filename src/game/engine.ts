import { QUESTIONS, type Question } from './questions.ts'

export type Phase = 'lobby' | 'answering' | 'voting' | 'reveal' | 'final'
export type Source = 'builtin' | 'custom' | 'ai'

export const TRUTH_POINTS = 2
export const FOOL_POINTS = 1
export const MAX_NAME = 14
export const MAX_ANSWER = 80
export const MAX_PROMPT = 160
export const MAX_CUSTOM_PER_PLAYER = 10
export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 8
export const ROUND_CHOICES = [5, 8, 12] as const
export const TIMER_CHOICES = [0, 45, 60, 90] as const // seconds to write; 0 = no timer
export const VOTE_SECONDS = 30

interface Player {
  pid: string
  name: string
  score: number
  connected: boolean
}

interface GameQuestion extends Question {
  id: string
  source: Source
  author?: string // pid, for custom questions
}

interface Option {
  id: string
  text: string
  owners: string[] // pids who wrote it; empty for the truth
  isTruth: boolean
}

interface Round {
  q: GameQuestion
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
  done: boolean // answered (answering) / voted (voting)
  customCount: number
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
  timer: number
  aiCount: number
  myCustoms: { id: string; prompt: string; answer: string }[]
  msLeft?: number
  prompt?: string
  source?: Source
  askedBy?: string // name of the player who wrote this custom question
  iAsked?: boolean
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
  timer = 0
  private players: Player[] = []
  private roundNo = 0
  private deck: GameQuestion[] = []
  private customs: GameQuestion[] = []
  private ai: GameQuestion[] = []
  private used = new Set<string>()
  private cur?: Round
  private deadline?: number
  private nextId = 1
  private rng: () => number
  private now: () => number

  constructor(code: string, hostPid: string, rng: () => number = Math.random, now: () => number = Date.now) {
    this.code = code
    this.hostPid = hostPid
    this.rng = rng
    this.now = now
  }

  private get(pid: string) {
    return this.players.find((p) => p.pid === pid)
  }

  private active() {
    return this.players.filter((p) => p.connected)
  }

  // ---------- lobby ----------

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
      this.customs = this.customs.filter((q) => q.author !== pid)
      return
    }
    p.connected = connected
    this.checkProgress()
  }

  setRounds(n: number) {
    if (this.phase === 'lobby' && (ROUND_CHOICES as readonly number[]).includes(n)) this.totalRounds = n
  }

  setTimer(sec: number) {
    if (this.phase === 'lobby' && (TIMER_CHOICES as readonly number[]).includes(sec)) this.timer = sec
  }

  addCustom(pid: string, rawPrompt: string, rawAnswer: string): string | null {
    if (this.phase !== 'lobby' && this.phase !== 'final') return 'Add questions between games.'
    if (!this.get(pid)) return 'Join the room first.'
    const prompt = rawPrompt.trim().slice(0, MAX_PROMPT)
    const answer = rawAnswer.trim().slice(0, MAX_ANSWER)
    if (!prompt || !answer) return 'Write both a question and its real answer.'
    if (this.customs.filter((q) => q.author === pid).length >= MAX_CUSTOM_PER_PLAYER) {
      return `You can add up to ${MAX_CUSTOM_PER_PLAYER} questions.`
    }
    this.customs.push({ id: `c${this.nextId++}`, prompt, answer, source: 'custom', author: pid })
    return null
  }

  removeCustom(pid: string, id: string) {
    this.customs = this.customs.filter((q) => !(q.id === id && q.author === pid))
  }

  addAi(qs: Question[]) {
    for (const q of qs) {
      if (this.used.has(normalize(q.prompt))) continue
      this.ai.push({ ...q, id: `a${this.nextId++}`, source: 'ai' })
    }
  }

  start(): string | null {
    if (this.phase !== 'lobby' && this.phase !== 'final') return 'Already running.'
    if (this.active().length < MIN_PLAYERS) return `Need at least ${MIN_PLAYERS} players.`
    for (const p of this.players) p.score = 0
    this.roundNo = 0
    // Player-written and AI questions are guaranteed a slot; built-ins fill the rest.
    const special = shuffle([...this.customs, ...this.ai], this.rng)
    let builtin = QUESTIONS.filter((q) => !this.used.has(normalize(q.prompt)))
    if (builtin.length < this.totalRounds) {
      this.used.clear()
      builtin = QUESTIONS
    }
    const filler = shuffle(builtin, this.rng).map((q) => ({ ...q, id: `b${this.nextId++}`, source: 'builtin' as const }))
    this.deck = shuffle([...special, ...filler].slice(0, this.totalRounds), this.rng)
    // Leftover custom/AI questions carry over to the next game.
    const usedIds = new Set(this.deck.map((q) => q.id))
    this.customs = this.customs.filter((q) => !usedIds.has(q.id))
    this.ai = this.ai.filter((q) => !usedIds.has(q.id))
    this.beginRound()
    return null
  }

  backToLobby() {
    this.phase = 'lobby'
    this.cur = undefined
    this.deadline = undefined
    this.players = this.players.filter((p) => p.connected)
    for (const p of this.players) p.score = 0
  }

  // ---------- rounds ----------

  private beginRound() {
    this.roundNo += 1
    const q = this.deck.pop()!
    this.used.add(normalize(q.prompt))
    this.cur = { q, fakes: new Map(), options: [], votes: new Map(), gains: new Map() }
    this.phase = 'answering'
    this.deadline = this.timer ? this.now() + this.timer * 1000 : undefined
  }

  private canVote(pid: string) {
    return pid !== this.cur?.q.author
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
    if (!this.canVote(pid)) return 'You wrote this question, so you sit this vote out.'
    const opt = r.options.find((o) => o.id === optionId)
    if (!opt) return 'Pick one of the answers.'
    if (opt.owners.includes(pid)) return "You can't vote for your own answer."
    r.votes.set(pid, optionId)
    this.checkProgress()
    return null
  }

  /** Host pushes the game forward without waiting on stragglers. */
  advance(): string | null {
    if (this.phase === 'answering') this.toVoting()
    else if (this.phase === 'voting') this.toReveal()
    else if (this.phase === 'reveal') {
      if (this.roundNo >= this.totalRounds) {
        this.phase = 'final'
        this.deadline = undefined
      } else this.beginRound()
    } else return 'Nothing to advance.'
    return null
  }

  /** Call regularly on the host. Returns true if the state changed. */
  tick(): boolean {
    if (this.deadline === undefined || this.now() < this.deadline) return false
    this.advance()
    return true
  }

  private checkProgress() {
    const r = this.cur
    if (!r) return
    const act = this.active()
    if (this.phase === 'answering') {
      if (act.length > 0 && act.every((p) => r.fakes.has(p.pid))) this.toVoting()
    } else if (this.phase === 'voting') {
      const voters = act.filter((p) => this.canVote(p.pid))
      if (voters.every((p) => r.votes.has(p.pid))) this.toReveal()
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
    if (grouped.size === 0) {
      // Nobody wrote anything before the timer ran out; just show the answer.
      this.toReveal()
      return
    }
    this.phase = 'voting'
    this.deadline = this.timer ? this.now() + VOTE_SECONDS * 1000 : undefined
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
    this.deadline = undefined
  }

  // ---------- views ----------

  view(me: string): View {
    const r = this.cur
    const name = (pid: string) => this.get(pid)?.name ?? '?'
    const v: View = {
      code: this.code,
      phase: this.phase,
      me,
      hostPid: this.hostPid,
      roundNo: this.roundNo,
      totalRounds: this.totalRounds,
      timer: this.timer,
      aiCount: this.ai.length,
      myCustoms: this.customs
        .filter((q) => q.author === me)
        .map((q) => ({ id: q.id, prompt: q.prompt, answer: q.answer })),
      players: this.players.map((p) => ({
        pid: p.pid,
        name: p.name,
        score: p.score,
        connected: p.connected,
        customCount: this.customs.filter((q) => q.author === p.pid).length,
        done:
          this.phase === 'answering'
            ? !!r?.fakes.has(p.pid)
            : this.phase === 'voting'
              ? !!r?.votes.has(p.pid) || !this.canVote(p.pid)
              : false,
      })),
    }
    if (this.deadline !== undefined) v.msLeft = Math.max(0, this.deadline - this.now())
    if (!r || this.phase === 'lobby' || this.phase === 'final') return v
    v.prompt = r.q.prompt
    v.source = r.q.source
    if (r.q.author) {
      v.askedBy = name(r.q.author)
      v.iAsked = r.q.author === me
    }
    if (this.phase === 'answering') {
      v.iAnswered = r.fakes.has(me)
      v.myAnswer = r.fakes.get(me)
    } else {
      v.options = r.options.map((o) => ({ id: o.id, text: o.text }))
      v.myOptions = r.options.filter((o) => o.owners.includes(me)).map((o) => o.id)
      v.myVote = r.votes.get(me)
    }
    if (this.phase === 'reveal') {
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
