import { useMemo, useState } from 'react'

type Line = { qty: number; unit: string; desc: string; price: number }

const SAMPLE = `Kitchen Reno takeoff (messy pad notes)
- drywall 5/8  42 sheets @ 18.50
mud + tape 12 buckets 14.00
2x4x12 studs x 86  4.25
R13 insulation 28 bags ~32
paint labor 16 hrs @ 65
paint 8 gal @ 38
baseboard 210 lf 1.85
interior doors 6 @ 145
door hardware 6 sets 28
demo dumpster 1 475
misc fasteners allowance 125
hang drywall labor 24 hrs 55
cleanup crew 4 hrs (no rate written)
NOTE: add 10% waste on drywall sheets — don't transpose 42/24`

const BOOK: Record<string, number> = {
  drywall: 18.5, mud: 14, stud: 4.25, insulation: 32, paint: 38,
  labor: 55, baseboard: 1.85, door: 145, hardware: 28, dumpster: 475,
  cleanup: 55, fastener: 125,
}

function guessPrice(desc: string) {
  const d = desc.toLowerCase()
  for (const [k, v] of Object.entries(BOOK)) if (d.includes(k)) return v
  if (/hr|labor|crew/.test(d)) return 55
  return 0
}

function parseTakeoff(text: string): Line[] {
  const lines: Line[] = []
  for (const raw of text.split(/\n/)) {
    let line = raw.replace(/^[-*•]\s*/, '').trim()
    if (!line || /^(note:|kitchen|takeoff)/i.test(line)) continue

    let m = line.match(/(.+?)\s+(\d+(?:\.\d+)?)\s*(sheets?|bags?|buckets?|sets?|hrs?|hours|lf|gal|ea|each|pcs)?\s*(?:@|at)\s*\$?(\d+(?:\.\d+)?)/i)
    if (m) {
      lines.push({ desc: m[1].trim(), qty: +m[2], unit: norm(m[3] || 'ea'), price: +m[4] })
      continue
    }
    m = line.match(/(.+?)\s+x\s*(\d+)\s*\$?(\d+(?:\.\d+)?)?/i)
    if (m) {
      lines.push({ desc: m[1].trim(), qty: +m[2], unit: 'ea', price: m[3] ? +m[3] : guessPrice(m[1]) })
      continue
    }
    m = line.match(/(.+?)\s+(\d+(?:\.\d+)?)\s*(sheets?|bags?|buckets?|sets?|hrs?|hours|lf|gal|ea|each|pcs)\b(?:\s*[~@]?\s*\$?(\d+(?:\.\d+)?)(?:\/\w+)?)?/i)
    if (m) {
      lines.push({ desc: m[1].trim(), qty: +m[2], unit: norm(m[3]), price: m[4] ? +m[4] : guessPrice(m[1]) })
      continue
    }
    m = line.match(/(.+?)\s+(\d+(?:\.\d+)?)\s*$/)
    if (m) {
      const n = +m[2]
      if (/allowance|misc|fastener|dumpster/i.test(m[1]) || n >= 50) {
        lines.push({ desc: m[1].trim(), qty: 1, unit: 'ls', price: n })
      } else {
        lines.push({ desc: m[1].trim(), qty: n, unit: 'ea', price: guessPrice(m[1]) })
      }
      continue
    }
    if (/waste|cleanup/i.test(line)) {
      lines.push({ desc: line, qty: 1, unit: 'ls', price: guessPrice(line) })
    }
  }

  // drywall waste 10% of sheet stock if mentioned in notes
  if (/10%\s*waste|waste.*drywall|drywall.*waste/i.test(text)) {
    const dw = lines.filter((l) => /drywall|sheetrock/i.test(l.desc) && /sheet/i.test(l.unit))
    const material = dw.reduce((s, l) => s + l.qty * l.price, 0)
    if (material > 0) lines.push({ qty: 1, unit: 'ls', desc: 'Drywall waste allowance (10%)', price: +(material * 0.1).toFixed(2) })
  }
  return lines
}

function norm(u: string) {
  u = (u || 'ea').toLowerCase()
  if (/sheet/.test(u)) return 'sheets'
  if (/hr/.test(u)) return 'hrs'
  if (/bag/.test(u)) return 'bags'
  if (/bucket/.test(u)) return 'buckets'
  if (/set/.test(u)) return 'sets'
  if (/each|ea|pcs/.test(u)) return 'ea'
  return u
}

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export default function App() {
  const [raw, setRaw] = useState(SAMPLE)
  const [rows, setRows] = useState<Line[] | null>(null)
  const [taxOn, setTaxOn] = useState(false)
  const [taxRate, setTaxRate] = useState(7.75)

  const sub = useMemo(() => (rows || []).reduce((s, r) => s + r.qty * r.price, 0), [rows])
  const tax = taxOn ? sub * (taxRate / 100) : 0
  const total = sub + tax

  function clean() {
    setRows(parseTakeoff(raw))
  }

  function update(i: number, field: keyof Line, value: string) {
    if (!rows) return
    const next = rows.map((r, idx) => {
      if (idx !== i) return r
      if (field === 'qty' || field === 'price') return { ...r, [field]: Number(value) || 0 }
      return { ...r, [field]: value }
    })
    setRows(next)
  }

  function downloadCsv() {
    if (!rows) return
    const lines = [
      ['qty', 'unit', 'description', 'unit_price', 'line_total'],
      ...rows.map((r) => [r.qty, r.unit, r.desc, r.price.toFixed(2), (r.qty * r.price).toFixed(2)]),
    ]
    const csv = lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'quoteclean-estimate.csv'
    a.click()
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 18px 64px' }}>
      <div style={badge}>Cal Poly · Vibe Coding Club · student demo for estimators</div>
      <h1 style={{ margin: '14px 0 8px', letterSpacing: '-0.02em', fontSize: 'clamp(1.6rem, 3vw, 2.2rem)' }}>
        Turn messy takeoff notes into a clean estimate
      </h1>
      <p style={{ color: '#8b9bb0', maxWidth: '62ch' }}>
        Built for the re-key / transpose grind — paste rough pad notes, get a bid-ready line list in about a minute.
        No login. Demo for estimators tired of typing every line twice.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16, marginTop: 22 }}>
        <section style={card}>
          <h2 style={h2}>1. Paste messy notes</h2>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            style={ta}
            spellCheck={false}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" style={ghost} onClick={() => setRaw(SAMPLE)}>Load sample takeoff</button>
            <button type="button" style={primary} onClick={clean}>Clean into estimate</button>
          </div>
        </section>

        <section style={card}>
          <h2 style={h2}>2. Clean estimate {rows ? <span style={{ color: '#5dd39e' }}>· {rows.length} lines</span> : null}</h2>
          {!rows ? (
            <div style={{ color: '#8b9bb0', padding: '48px 8px', textAlign: 'center' }}>Your cleaned line items show up here.</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Qty', 'Unit', 'Description', 'Unit $', 'Total'].map((h) => (
                        <th key={h} style={{ ...th, textAlign: h.includes('$') || h === 'Total' || h === 'Qty' ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td style={td}><input style={inpR} value={r.qty} onChange={(e) => update(i, 'qty', e.target.value)} /></td>
                        <td style={td}><input style={inp} value={r.unit} onChange={(e) => update(i, 'unit', e.target.value)} /></td>
                        <td style={td}><input style={inp} value={r.desc} onChange={(e) => update(i, 'desc', e.target.value)} /></td>
                        <td style={td}><input style={inpR} value={r.price} onChange={(e) => update(i, 'price', e.target.value)} /></td>
                        <td style={{ ...td, textAlign: 'right', color: '#cfe7ff' }}>{money(r.qty * r.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" style={ghost} onClick={downloadCsv}>Download CSV</button>
                <button type="button" style={ghost} onClick={() => window.print()}>Print / PDF</button>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#8b9bb0', fontSize: 13 }}>
                  <input type="checkbox" checked={taxOn} onChange={(e) => setTaxOn(e.target.checked)} /> Tax
                  <input style={{ ...inp, width: 64 }} value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value) || 0)} /> %
                </label>
              </div>
              <div style={{ marginTop: 14, display: 'grid', justifyItems: 'end', gap: 6, color: '#8b9bb0' }}>
                <div style={tot}>Subtotal <b style={{ color: '#e8eef5' }}>{money(sub)}</b></div>
                {taxOn && <div style={tot}>Tax <b style={{ color: '#e8eef5' }}>{money(tax)}</b></div>}
                <div style={{ ...tot, fontSize: '1.15rem', color: '#e8eef5' }}>Grand total <b>{money(total)}</b></div>
              </div>
            </>
          )}
        </section>
      </div>

      <p style={{ marginTop: 22, color: '#8b9bb0', fontSize: 13, maxWidth: '70ch' }}>
        Student MVP by Milo — validating a 1-minute quote cleaner for trades estimators.
        60-sec demo: Load sample → Clean into estimate → tweak a price → export CSV.
      </p>
    </div>
  )
}

const badge: React.CSSProperties = {
  display: 'inline-flex', gap: 8, fontSize: 12, color: '#3dd6c6',
  background: 'rgba(61,214,198,.1)', border: '1px solid rgba(61,214,198,.25)',
  padding: '6px 10px', borderRadius: 999,
}
const card: React.CSSProperties = {
  background: 'linear-gradient(180deg,#1a222c,#161c24)', border: '1px solid #2c3848',
  borderRadius: 16, padding: 16, boxShadow: '0 10px 40px rgba(0,0,0,.25)',
}
const h2: React.CSSProperties = { margin: '0 0 10px', fontSize: 12, color: '#8b9bb0', letterSpacing: '.06em', textTransform: 'uppercase' }
const ta: React.CSSProperties = {
  width: '100%', minHeight: 280, resize: 'vertical', background: '#232d3a', color: '#e8eef5',
  border: '1px solid #2c3848', borderRadius: 12, padding: 14, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13,
}
const primary: React.CSSProperties = { border: 0, borderRadius: 10, padding: '11px 16px', fontWeight: 600, cursor: 'pointer', background: 'linear-gradient(135deg,#3dd6c6,#2bb3c4)', color: '#06201d' }
const ghost: React.CSSProperties = { borderRadius: 10, padding: '11px 16px', fontWeight: 600, cursor: 'pointer', background: 'transparent', color: '#e8eef5', border: '1px solid #2c3848' }
const th: React.CSSProperties = { padding: '10px 8px', borderBottom: '1px solid #2c3848', color: '#8b9bb0', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }
const td: React.CSSProperties = { padding: '6px 4px', borderBottom: '1px solid #2c3848' }
const inp: React.CSSProperties = { width: '100%', background: 'transparent', border: '1px solid transparent', color: '#e8eef5', borderRadius: 6, padding: '6px 8px' }
const inpR: React.CSSProperties = { ...inp, textAlign: 'right' }
const tot: React.CSSProperties = { display: 'flex', gap: 24, minWidth: 240, justifyContent: 'space-between' }
