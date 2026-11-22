import { useState } from 'react'
import { MAX_ANSWER, MAX_NAME, MIN_PLAYERS, type View } from './game/engine.ts'
import { useSession } from './game/useSession.ts'

type S = ReturnType<typeof useSession>

const params = new URLSearchParams(location.search)

export default function App() {
  const s = useSession()
  const { view } = s
  return (
    <main className="app">
      <header className="top">
        <span className="logo">Psych</span>
        {view && (
          <button className="link" onClick={s.leave}>
            Leave
          </button>
        )}
      </header>
      {s.status === 'reconnecting' && <div className="banner">Reconnecting…</div>}
      {!view ? <Home s={s} /> : <Game s={s} view={view} />}
      {s.error && <p className="error">{s.error}</p>}
    </main>
  )
}

function Home({ s }: { s: S }) {
  const [name, setName] = useState(() => localStorage.getItem('psych.name') ?? '')
  const [code, setCode] = useState(() => (params.get('join') ?? '').toUpperCase())
  const busy = s.status === 'connecting'
  const ok = name.trim().length > 0
  const remember = () => localStorage.setItem('psych.name', name.trim())
  return (
    <section className="card stack">
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

function Game({ s, view }: { s: S; view: View }) {
  switch (view.phase) {
    case 'lobby':
      return <Lobby s={s} view={view} />
    case 'answering':
      return <Answering s={s} view={view} />
    case 'voting':
      return <Voting s={s} view={view} />
    case 'reveal':
      return <Reveal s={s} view={view} />
    case 'final':
      return <Final s={s} view={view} />
  }
}

function RoundBar({ view }: { view: View }) {
  return (
    <div className="roundbar">
      <span>
        Round {view.roundNo} of {view.totalRounds}
      </span>
    </div>
  )
}

function Chips({ view, label }: { view: View; label: string }) {
  return (
    <ul className="chips" aria-label={label}>
      {view.players.map((p) => (
        <li key={p.pid} className={p.done ? 'chip done' : 'chip'}>
          {p.done ? '✓ ' : ''}
          {p.name}
        </li>
      ))}
    </ul>
  )
}

function Lobby({ s, view }: { s: S; view: View }) {
  const isHost = view.me === view.hostPid
  const link = `${location.origin}${location.pathname}?join=${view.code}${location.search.includes('mem') ? '&mem' : ''}`
  const enough = view.players.filter((p) => p.connected).length >= MIN_PLAYERS
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
    <section className="card stack">
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
            {p.name}
            {p.pid === view.hostPid && <span className="tag">host</span>}
          </li>
        ))}
      </ul>
      {isHost ? (
        <>
          <label>
            Rounds
            <select onChange={(e) => s.setRounds(Number(e.target.value))} defaultValue={view.totalRounds}>
              <option value={5}>5 (quick)</option>
              <option value={8}>8</option>
              <option value={12}>12 (long night)</option>
            </select>
          </label>
          <button className="primary" disabled={!enough} onClick={s.start}>
            {enough ? 'Start game' : `Waiting for ${MIN_PLAYERS - view.players.length} more…`}
          </button>
          <p className="muted small center">Keep this tab open: your phone is running the game.</p>
        </>
      ) : (
        <p className="muted center">Waiting for the host to start…</p>
      )}
    </section>
  )
}

function Answering({ s, view }: { s: S; view: View }) {
  const [text, setText] = useState('')
  const isHost = view.me === view.hostPid
  const submitted = view.iAnswered
  return (
    <section className="card stack">
      <RoundBar view={view} />
      <h2 className="prompt">{view.prompt}</h2>
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
            if (text.trim()) s.answer(text)
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

function Voting({ s, view }: { s: S; view: View }) {
  const isHost = view.me === view.hostPid
  const mine = new Set(view.myOptions)
  return (
    <section className="card stack">
      <RoundBar view={view} />
      <h2 className="prompt">{view.prompt}</h2>
      <p className="muted center small">
        {view.myVote ? 'Vote locked in. Waiting for the others…' : 'Which one is the real answer?'}
      </p>
      <div className="stack">
        {view.options?.map((o) => {
          const own = mine.has(o.id)
          const chosen = view.myVote === o.id
          return (
            <button
              key={o.id}
              className={`option${chosen ? ' chosen' : ''}`}
              disabled={own || !!view.myVote}
              onClick={() => s.vote(o.id)}
            >
              {o.text}
              {own && <span className="tag">yours</span>}
            </button>
          )
        })}
      </div>
      <Chips view={view} label="Who has voted" />
      {isHost && view.myVote && (
        <button className="link" onClick={s.advance}>
          Skip waiting
        </button>
      )}
    </section>
  )
}

function Reveal({ s, view }: { s: S; view: View }) {
  const isHost = view.me === view.hostPid
  const r = view.reveal!
  const last = view.roundNo >= view.totalRounds
  const name = (pid: string) => view.players.find((p) => p.pid === pid)?.name ?? '?'
  const gains = Object.entries(r.gains).filter(([, g]) => g > 0)
  return (
    <section className="card stack">
      <RoundBar view={view} />
      <h2 className="prompt">{view.prompt}</h2>
      <div className="stack">
        {r.rows.map((row) => (
          <div key={row.id} className={row.isTruth ? 'row truth' : 'row'}>
            <div className="rowtext">{row.text}</div>
            <div className="rowmeta">
              {row.isTruth ? (
                <strong>The truth</strong>
              ) : (
                <span>Written by {row.authors.join(' & ')}</span>
              )}
              {row.voters.length > 0 && <span> · picked by {row.voters.join(', ')}</span>}
            </div>
          </div>
        ))}
      </div>
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
    </section>
  )
}

function Scoreboard({ view }: { view: View }) {
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

function Final({ s, view }: { s: S; view: View }) {
  const isHost = view.me === view.hostPid
  const sorted = [...view.players].sort((a, b) => b.score - a.score)
  const top = sorted.filter((p) => p.score === sorted[0].score)
  return (
    <section className="card stack">
      <div className="center">
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
