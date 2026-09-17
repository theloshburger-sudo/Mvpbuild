import { useMemo, useState } from 'react'
import { parseTakeoff, type Line } from './parseTakeoff'
import { xlsxToTsv } from './parseXlsx'
import { SAMPLE_EXCEL, SAMPLE_NOTES } from './samples'

type InputMode = 'notes' | 'excel'

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export default function App() {
  const [mode, setMode] = useState<InputMode>('notes')
  const [raw, setRaw] = useState(SAMPLE_NOTES)
  const [rows, setRows] = useState<Line[] | null>(null)
  const [taxOn, setTaxOn] = useState(false)
  const [taxRate, setTaxRate] = useState(7.75)
  const [fileLabel, setFileLabel] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const sub = useMemo(() => (rows || []).reduce((s, r) => s + r.qty * r.price, 0), [rows])
  const tax = taxOn ? sub * (taxRate / 100) : 0
  const total = sub + tax
  const sample = mode === 'notes' ? SAMPLE_NOTES : SAMPLE_EXCEL

  function switchMode(next: InputMode) {
    setMode(next)
    setNotice(null)
    if (raw === SAMPLE_NOTES || raw === SAMPLE_EXCEL || raw.trim() === '') {
      setRaw(next === 'notes' ? SAMPLE_NOTES : SAMPLE_EXCEL)
      setFileLabel(null)
    }
  }

  function clean() {
    setNotice(null)
    setRows(parseTakeoff(raw))
  }

  function loadSample() {
    setRaw(sample)
    setFileLabel(null)
    setNotice(null)
    setRows(null)
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

  async function onFile(file: File | undefined) {
    if (!file) return
    const name = file.name.toLowerCase()
    try {
      if (name.endsWith('.xls') && !name.endsWith('.xlsx')) {
        throw new Error('Old .xls isn’t supported. Save the Excel template as .xlsx or .csv, or copy the used range and paste.')
      }
      let text: string
      if (name.endsWith('.xlsx')) {
        text = xlsxToTsv(await file.arrayBuffer())
      } else {
        text = stripBom(await file.text())
      }
      setRaw(text)
      setMode('excel')
      setFileLabel(file.name)
      setNotice(null)
      setRows(null)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not read that file.')
    }
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
        PlanSwift takeoff → clean estimate — no re-key
      </h1>
      <p style={{ color: '#8b9bb0', maxWidth: '68ch' }}>
        Built for offices that take off in PlanSwift, then write quantities by hand or drop them into an Excel template.
        Paste the pad notes or the template rows. Get a bid-ready line list without transposing every takeoff.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16, marginTop: 22 }}>
        <section style={card}>
          <h2 style={h2}>1. Takeoff input</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <button type="button" style={mode === 'notes' ? tabOn : tabOff} onClick={() => switchMode('notes')}>
              PlanSwift hand notes
            </button>
            <button type="button" style={mode === 'excel' ? tabOn : tabOff} onClick={() => switchMode('excel')}>
              Excel template
            </button>
          </div>
          <p style={{ color: '#8b9bb0', fontSize: 13, margin: '0 0 10px' }}>
            {mode === 'notes'
              ? 'Type or paste what you wrote while taking off in PlanSwift — counts, LF/SF, missing rates, waste notes.'
              : 'Paste rows copied from the Excel template (tabs or CSV). Or upload the .csv / .xlsx the office already uses.'}
          </p>
          <textarea
            value={raw}
            onChange={(e) => { setRaw(e.target.value); setFileLabel(null) }}
            style={ta}
            spellCheck={false}
            aria-label={mode === 'notes' ? 'PlanSwift hand notes' : 'Excel template rows'}
          />
          {fileLabel && (
            <div style={{ color: '#3dd6c6', fontSize: 12, marginTop: 8 }}>Loaded {fileLabel}</div>
          )}
          {notice && (
            <div style={{ color: '#f0a4a4', fontSize: 13, marginTop: 8 }}>{notice}</div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" style={ghost} onClick={loadSample}>
              {mode === 'notes' ? 'Load sample hand notes' : 'Load sample Excel template'}
            </button>
            <label style={{ ...ghost, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
              Upload .csv / .xlsx
              <input
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                style={{ display: 'none' }}
                onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }}
              />
            </label>
            <button type="button" style={primary} onClick={clean}>Clean into estimate</button>
          </div>
        </section>

        <section style={card}>
          <h2 style={h2}>2. Clean estimate {rows ? <span style={{ color: '#5dd39e' }}>· {rows.length} lines</span> : null}</h2>
          {!rows ? (
            <div style={{ color: '#8b9bb0', padding: '48px 8px', textAlign: 'center' }}>
              Line items from the takeoff notes or Excel template show up here.
            </div>
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

      <p style={{ marginTop: 22, color: '#8b9bb0', fontSize: 13, maxWidth: '72ch' }}>
        Student MVP by Milo — PlanSwift takeoff notes or the office Excel template, cleaned in about a minute.
        Demo: Hand notes or Excel template → Clean into estimate → tweak a price → export CSV.
      </p>
    </div>
  )
}

function stripBom(s: string) {
  return s.replace(/^\uFEFF/, '')
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
const tabOn: React.CSSProperties = { ...ghost, borderColor: '#3dd6c6', color: '#3dd6c6' }
const tabOff: React.CSSProperties = ghost
const th: React.CSSProperties = { padding: '10px 8px', borderBottom: '1px solid #2c3848', color: '#8b9bb0', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }
const td: React.CSSProperties = { padding: '6px 4px', borderBottom: '1px solid #2c3848' }
const inp: React.CSSProperties = { width: '100%', background: 'transparent', border: '1px solid transparent', color: '#e8eef5', borderRadius: 6, padding: '6px 8px' }
const inpR: React.CSSProperties = { ...inp, textAlign: 'right' }
const tot: React.CSSProperties = { display: 'flex', gap: 24, minWidth: 240, justifyContent: 'space-between' }
