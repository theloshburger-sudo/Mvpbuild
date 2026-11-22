import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MAX_ANSWER,
  MAX_CUSTOM_PER_PLAYER,
  MAX_NAME,
  MAX_PROMPT,
  MIN_PLAYERS,
  ROUND_CHOICES,
  TIMER_CHOICES,
  VOTE_SECONDS,
} from './game/engine.ts'
import { useSession, type LocalView } from './game/useSession.ts'
import { isMuted, setMuted, sfx } from './sfx.ts'

type S = ReturnType<typeof useSession>
type V = LocalView

const params = new URLSearchParams(location.search)
const readLocal = (k: string) => {
  try {
    return localStorage.getItem(k) ?? ''
  } catch {
    return ''
  }
}
const writeLocal = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* ignore */
  }
}

export default function App() {
  const s = useSession()
  const { view } = s
  const [muted, setMutedState] = useState(isMuted)
  return (
    <main className="app">
      <header className="top">
        <span className="logo">Psych</span>
        <div className="top-actions">
          <button
            className="icon"
            aria-label={muted ? 'Unmute' : 'Mute'}
            onClick={() => {
              setMuted(!muted)
              setMutedState(!muted)
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          {view && (
            <button className="link" onClick={s.leave}>
              Leave
            </button>
          )}
        </div>
      </header>
      {s.status === 'reconnecting' && <div className="banner">Reconnecting…</div>}
      {!view ? <Home s={s} /> : <Game s={s} view={view} />}
      {s.error && <p className="error">{s.error}</p>}
    </main>
  )
}

function Home({ s }: { s: S }) {
  const [name, setName] = useState(() => readLocal('psych.name'))
  const [code, setCode] = useState(() => (params.get('join') ?? '').toUpperCase())
  const busy = s.status === 'connecting'
  const ok = name.trim().length > 0
  const remember = () => writeLocal('psych.name', name.trim())
  return (
    <section className="card stack pop">
      <h1>Fool your friends.</h1>
      <p className="muted">
        Everyone gets a weird question. Write a fake answer that sounds real, then try to spot the truth.
      </p>
      <label>
        Your name
        <input value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </label>
      <label>
        Room code
        <input
          className="code-input"
          value={code}
          maxLength={4}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="ABCD"
        />
      </label>
      <button
        className="primary"
        disabled={!ok || code.length !== 4 || busy}
        onClick={() => {
          remember()
          void s.joinRoom(code, name)
        }}
      >
        {busy ? 'Connecting…' : 'Join room'}
      </button>
      <div className="or">or</div>
      <button
        className="secondary"
        disabled={!ok || busy}
        onClick={() => {
          remember()
          void s.createRoom(name)
        }}
      >
        Start a new room
      </button>
    </section>
  )
}

function Game({ s, view }: { s: S; view: V }) {
  // Sound cue whenever the phase changes.
  const key = `${view.phase}-${view.roundNo}`
  const lastKey = useRef(key)
  useEffect(() => {
    if (lastKey.current === key) return
    lastKey.current = key
    if (view.phase === 'answering') sfx.newRound()
    else if (view.phase === 'voting') sfx.vote()
    else if (view.phase === 'final') sfx.win()
  }, [key, view.phase])

  switch (view.phase) {
    case 'lobby':
      return <Lobby s={s} view={view} />
    case 'answering':
      return <Answering key={key} s={s} view={view} />
    case 'voting':
      return <Voting key={key} s={s} view={view} />
    case 'reveal':
      return <Reveal key={key} s={s} view={view} />
    case 'final':
      return <Final s={s} view={view} />
  }
}

// ---------- shared bits ----------

function RoundBar({ view }: { view: V }) {
  return (
    <div className="roundbar">
      Round {view.roundNo} of {view.totalRounds}
      {view.source === 'ai' && <span className="tag">AI</span>}
      {view.askedBy && <span className="tag">{view.askedBy}'s question</span>}
    </div>
  )
}

function Countdown({ view, total }: { view: V; total: number }) {
  const [now, setNow] = useState(() => Date.now())
  const lastSec = useRef<number | null>(null)
  useEffect(() => {
    if (!view.deadlineAt) return
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [view.deadlineAt])
  const left = view.deadlineAt ? Math.max(0, view.deadlineAt - now) : 0
  const sec = Math.ceil(left / 1000)
  useEffect(() => {
    if (!view.deadlineAt) return
    if (sec <= 5 && sec > 0 && lastSec.current !== sec) sfx.tick()
    lastSec.current = sec
  }, [sec, view.deadlineAt])
  if (!view.deadlineAt) return null
  const pct = Math.min(100, (left / total) * 100)
  return (
    <div className={`timer${sec <= 5 ? ' urgent' : ''}`} aria-label={`${sec} seconds left`}>
      <div className="timer-fill" style={{ width: `${pct}%` }} />
      <span>{sec}s</span>
    </div>
  )
}

function Chips({ view, label }: { view: V; label: string }) {
  return (
    <ul className="chips" aria-label={label}>
      {view.players.map((p) => (
        <li key={p.pid} className={`chip${p.done ? ' done' : ''}${p.connected ? '' : ' away'}`}>
          {p.done ? '✓ ' : ''}
          {p.name}
        </li>
      ))}
    </ul>
  )
}

// ---------- lobby ----------

function Lobby({ s, view }: { s: S; view: V }) {
  const isHost = view.me === view.hostPid
  const link = `${location.origin}${location.pathname}?join=${view.code}${isMemNet() ? '&mem' : ''}`
  const connected = view.players.filter((p) => p.connected).length
  const enough = connected >= MIN_PLAYERS
  const [copied, setCopied] = useState(false)
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Psych', text: `Join my Psych room: ${view.code}`, url: link })
      else {
        await navigator.clipboard.writeText(link)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    } catch {
      /* user cancelled */
    }
  }
  return (
    <div className="stack">
      <section className="card stack pop">
        <div className="center">
          <div className="muted small">Room code</div>
          <div className="bigcode" data-testid="code">
            {view.code}
          </div>
          <button className="link" onClick={share}>
            {copied ? 'Link copied!' : 'Share invite link'}
          </button>
        </div>
        <ul className="players">
          {view.players.map((p) => (
            <li key={p.pid}>
              <span>
                {p.name}
                {p.pid === view.hostPid && <span className="tag">host</span>}
              </span>
              {p.customCount > 0 && (
                <span className="muted small">
                  {p.customCount} question{p.customCount > 1 ? 's' : ''}
                </span>
              )}
            </li>
          ))}
        </ul>
        {isHost ? (
          <>
            <div className="row2">
              <label>
                Rounds
                <select value={view.totalRounds} onChange={(e) => s.setRounds(Number(e.target.value))}>
                  {ROUND_CHOICES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Timer
                <select value={view.timer} onChange={(e) => s.setTimer(Number(e.target.value))}>
                  {TIMER_CHOICES.map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? 'Off' : `${n}s to write`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button className="primary" disabled={!enough} onClick={s.start}>
              {enough ? 'Start game' : `Waiting for ${MIN_PLAYERS - connected} more…`}
            </button>
            <p className="muted small center">Keep this tab open: your phone is running the game.</p>
          </>
        ) : (
          <p className="muted center">Waiting for the host to start…</p>
        )}
      </section>
      <CustomQuestions s={s} view={view} />
      {isHost && <AiPanel s={s} view={view} />}
    </div>
  )
}

const isMemNet = () => new URLSearchParams(location.search).has('mem')

function CustomQuestions({ s, view }: { s: S; view: V }) {
  const [prompt, setPrompt] = useState('')
  const [answer, setAnswer] = useState('')
  const [count, setCount] = useState(view.myCustoms.length)
  // Clear the form once the host confirms the question was added.
  if (view.myCustoms.length !== count) {
    setCount(view.myCustoms.length)
    if (view.myCustoms.length > count) {
      setPrompt('')
      setAnswer('')
    }
  }
  const full = view.myCustoms.length >= MAX_CUSTOM_PER_PLAYER
  return (
    <section className="card stack">
      <div>
        <h3>Add your own questions</h3>
        <p className="muted small">
          Only you see these. Make them about yourself ("What's my weirdest fear?") or a fact you know. When yours
          comes up, you write a fake too but sit out the vote.
        </p>
      </div>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          if (prompt.trim() && answer.trim()) s.addCustom(prompt, answer)
        }}
      >
        <input
          value={prompt}
          maxLength={MAX_PROMPT}
          placeholder="Question"
          onChange={(e) => setPrompt(e.target.value)}
          disabled={full}
        />
        <input
          value={answer}
          maxLength={MAX_ANSWER}
          placeholder="The real answer"
          onChange={(e) => setAnswer(e.target.value)}
          disabled={full}
        />
        <button className="secondary" disabled={full || !prompt.trim() || !answer.trim()}>
          {full ? 'That’s the max' : 'Add question'}
        </button>
      </form>
      {view.myCustoms.length > 0 && (
        <ul className="customs">
          {view.myCustoms.map((q) => (
            <li key={q.id}>
              <div>
                <div>{q.prompt}</div>
                <div className="muted small">{q.answer}</div>
              </div>
              <button className="link" aria-label="Remove question" onClick={() => s.removeCustom(q.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AiPanel({ s, view }: { s: S; view: V }) {
  const [key, setKey] = useState(() => readLocal('psych.apiKey'))
  const [theme, setTheme] = useState('')
  const [note, setNote] = useState<string | null>(null)
  return (
    <details className="card ai">
      <summary>
        <h3>AI questions</h3>
        <span className="muted small">{view.aiCount > 0 ? `${view.aiCount} ready` : 'optional'}</span>
      </summary>
      <div className="stack">
        <p className="muted small">
          Have Claude write fresh questions on any theme. Uses your own Anthropic API key, stored only on this phone.
          Without one, the game uses its built-in questions.
        </p>
        <input
          type="password"
          value={key}
          placeholder="Anthropic API key (sk-ant-…)"
          autoComplete="off"
          onChange={(e) => {
            setKey(e.target.value)
            writeLocal('psych.apiKey', e.target.value.trim())
          }}
        />
        <input value={theme} placeholder="Theme, e.g. 90s movies, weird laws, food" onChange={(e) => setTheme(e.target.value)} />
        <button
          className="secondary"
          disabled={!key.trim() || s.aiBusy}
          onClick={async () => {
            setNote(null)
            const n = await s.generate(key.trim(), theme, 10)
            if (n) setNote(`Added ${n} question${n === 1 ? "" : "s"}. They'll be used first.`)
          }}
        >
          {s.aiBusy ? 'Writing questions… (up to a minute)' : 'Generate 10 questions'}
        </button>
        {note && <p className="good small center">{note}</p>}
      </div>
    </details>
  )
}

// ---------- rounds ----------

function Answering({ s, view }: { s: S; view: V }) {
  const [text, setText] = useState('')
  const isHost = view.me === view.hostPid
  const submitted = view.iAnswered
  return (
    <section className="card stack slide">
      <RoundBar view={view} />
      <Countdown view={view} total={view.timer * 1000} />
      <h2 className="prompt">{view.prompt}</h2>
      {view.iAsked && !submitted && (
        <p className="hint">This is your question. Write a fake anyway to throw them off. You'll sit out the vote.</p>
      )}
      {submitted ? (
        <div className="stack">
          <p className="center">
            Your answer: <strong>{view.myAnswer}</strong>
          </p>
          <p className="muted center">Waiting for everyone else…</p>
        </div>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) {
              sfx.submit()
              s.answer(text)
            }
          }}
        >
          <textarea
            value={text}
            maxLength={MAX_ANSWER}
            rows={3}
            placeholder="Write something that sounds true…"
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          <div className="muted small right">
            {text.length}/{MAX_ANSWER}
          </div>
          <button className="primary" disabled={!text.trim()}>
            Submit fake answer
          </button>
        </form>
      )}
      <Chips view={view} label="Who has answered" />
      {isHost && submitted && (
        <button className="link" onClick={s.advance}>
          Skip waiting
        </button>
      )}
    </section>
  )
}

function Voting({ s, view }: { s: S; view: V }) {
  const isHost = view.me === view.hostPid
  const mine = new Set(view.myOptions)
  const sittingOut = view.iAsked
  return (
    <section className="card stack slide">
      <RoundBar view={view} />
      <Countdown view={view} total={VOTE_SECONDS * 1000} />
      <h2 className="prompt">{view.prompt}</h2>
      <p className="muted center small">
        {sittingOut
          ? 'Your question, so you sit this vote out. Enjoy the show.'
          : view.myVote
            ? 'Vote locked in. Waiting for the others…'
            : 'Which one is the real answer?'}
      </p>
      <div className="stack">
        {view.options?.map((o, i) => {
          const own = mine.has(o.id)
          const chosen = view.myVote === o.id
          return (
            <button
              key={o.id}
              className={`option rise${chosen ? ' chosen' : ''}`}
              style={{ animationDelay: `${i * 70}ms` }}
              disabled={own || !!view.myVote || sittingOut}
              onClick={() => {
                sfx.tap()
                s.vote(o.id)
              }}
            >
              {o.text}
              {own && <span className="tag">yours</span>}
            </button>
          )
        })}
      </div>
      <Chips view={view} label="Who has voted" />
      {isHost && (view.myVote || sittingOut) && (
        <button className="link" onClick={s.advance}>
          Skip waiting
        </button>
      )}
    </section>
  )
}

const STEP_MS = 1300

function Reveal({ s, view }: { s: S; view: V }) {
  const isHost = view.me === view.hostPid
  const r = view.reveal!
  const last = view.roundNo >= view.totalRounds
  const name = (pid: string) => view.players.find((p) => p.pid === pid)?.name ?? '?'
  // Fakes first (least-picked first), the truth last for the drama.
  const rows = useMemo(
    () =>
      [...r.rows].sort((a, b) =>
        a.isTruth !== b.isTruth ? (a.isTruth ? 1 : -1) : a.voters.length - b.voters.length,
      ),
    [r.rows],
  )
  const [step, setStep] = useState(0)
  const done = step >= rows.length
  useEffect(() => {
    if (done) return
    const id = setTimeout(() => {
      const row = rows[step]
      if (row.isTruth) sfx.truth()
      else if (row.voters.length) sfx.fooled()
      else sfx.nobody()
      setStep(step + 1)
    }, step === 0 ? 500 : STEP_MS)
    return () => clearTimeout(id)
  }, [step, done, rows])
  const gains = Object.entries(r.gains).filter(([, g]) => g > 0)
  return (
    <section className="card stack" onClick={() => !done && setStep(rows.length)}>
      <RoundBar view={view} />
      <h2 className="prompt">{view.prompt}</h2>
      <div className="stack">
        {rows.slice(0, step).map((row) => (
          <div key={row.id} className={`row flip${row.isTruth ? ' truth' : ''}`}>
            <div className="rowtext">{row.text}</div>
            <div className="rowmeta">
              {row.isTruth ? <strong>The truth</strong> : <span>{row.authors.join(' & ')}'s fake</span>}
              {row.voters.length > 0 ? (
                <span> · {row.isTruth ? 'found by' : 'fooled'} {row.voters.join(', ')}</span>
              ) : (
                !row.isTruth && <span> · fooled nobody</span>
              )}
            </div>
          </div>
        ))}
        {!done && <p className="muted small center">Tap to skip</p>}
      </div>
      {done && (
        <div className="stack pop">
          {gains.length > 0 && (
            <ul className="gains">
              {gains.map(([pid, g]) => (
                <li key={pid}>
                  {name(pid)} <strong>+{g}</strong>
                </li>
              ))}
            </ul>
          )}
          <Scoreboard view={view} />
          {isHost ? (
            <button className="primary" onClick={s.advance}>
              {last ? 'See final results' : 'Next question'}
            </button>
          ) : (
            <p className="muted center small">Waiting for the host…</p>
          )}
        </div>
      )}
    </section>
  )
}

function Scoreboard({ view }: { view: V }) {
  const sorted = [...view.players].sort((a, b) => b.score - a.score)
  return (
    <ol className="scores">
      {sorted.map((p) => (
        <li key={p.pid} className={p.pid === view.me ? 'me' : ''}>
          <span>{p.name}</span>
          <strong>{p.score}</strong>
        </li>
      ))}
    </ol>
  )
}

function Final({ s, view }: { s: S; view: V }) {
  const isHost = view.me === view.hostPid
  const sorted = [...view.players].sort((a, b) => b.score - a.score)
  const top = sorted.filter((p) => p.score === sorted[0].score)
  return (
    <section className="card stack">
      <div className="center pop">
        <div className="trophy">🏆</div>
        <div className="muted small">{top.length > 1 ? 'Tied for the win' : 'Winner'}</div>
        <div className="winner">{top.map((p) => p.name).join(' & ')}</div>
      </div>
      <Scoreboard view={view} />
      {isHost ? (
        <button className="primary" onClick={s.playAgain}>
          Play again
        </button>
      ) : (
        <p className="muted center small">Waiting for the host to start another game…</p>
      )}
    </section>
  )
}
