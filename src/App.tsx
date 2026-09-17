import { useMemo, useState } from 'react'
import {
  mappingWarnings,
  parseTable,
  setRole,
  suggestRoles,
  swapQtyPrice,
} from './columns'
import { linesToCsv, linesToXlsx } from './exportSheet'
import { parseTakeoff } from './parseTakeoff'
import { xlsxToTsv } from './parseXlsx'
import { SAMPLE_EXCEL, SAMPLE_NOTES, SAMPLE_PLANSWIFT } from './samples'
import type { ColRole, Line } from './types'
import { ROLE_LABEL } from './types'

type InputMode = 'notes' | 'excel' | 'planswift'

const SAMPLES: Record<InputMode, string> = {
  notes: SAMPLE_NOTES,
  excel: SAMPLE_EXCEL,
  planswift: SAMPLE_PLANSWIFT,
}

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export default function App() {
  const [mode, setMode] = useState<InputMode>('planswift')
  const [raw, setRaw] = useState(SAMPLE_PLANSWIFT)
  const [roles, setRoles] = useState<ColRole[]>(() => {
    const t = parseTable(SAMPLE_PLANSWIFT)
    return t ? suggestRoles(t.headers, t.body) : []
  })
  const [mapLocked, setMapLocked] = useState(false)
  const [rows, setRows] = useState<Line[] | null>(null)
  const [taxOn, setTaxOn] = useState(false)
  const [taxRate, setTaxRate] = useState(7.75)
  const [fileLabel, setFileLabel] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const table = useMemo(() => parseTable(raw), [raw])
  const warnings = useMemo(
    () => (table && roles.length ? mappingWarnings(table.headers, table.body, roles) : []),
    [table, roles],
  )
  const sub = useMemo(() => (rows || []).reduce((s, r) => s + r.qty * r.price, 0), [rows])
  const tax = taxOn ? sub * (taxRate / 100) : 0
  const total = sub + tax
  const showVerify = Boolean(rows?.some((r) => r.sourceTotal != null))
  const warnCount = rows?.filter((r) => r.warnings.length).length ?? 0

  function applyRaw(next: string, nextMode: InputMode, file?: string | null) {
    setRaw(next)
    setMode(nextMode)
    setFileLabel(file ?? null)
    setNotice(null)
    setRows(null)
    setMapLocked(false)
    const t = parseTable(next)
    setRoles(t ? suggestRoles(t.headers, t.body) : [])
  }

  function switchMode(next: InputMode) {
    const sample = SAMPLES[next]
    if (raw === SAMPLE_NOTES || raw === SAMPLE_EXCEL || raw === SAMPLE_PLANSWIFT || raw.trim() === '') {
      applyRaw(sample, next)
    } else {
      setMode(next)
      setRows(null)
      setMapLocked(false)
      const t = parseTable(raw)
      setRoles(t ? suggestRoles(t.headers, t.body) : [])
    }
  }

  function loadSample() {
    applyRaw(SAMPLES[mode], mode)
  }

  function onRawChange(value: string) {
    setRaw(value)
    setFileLabel(null)
    setRows(null)
    setMapLocked(false)
    const t = parseTable(value)
    setRoles(t ? suggestRoles(t.headers, t.body) : [])
  }

  function buildEstimate() {
    setNotice(null)
    if (table && roles.some((r) => r !== 'ignore')) {
      setMapLocked(true)
      setRows(parseTakeoff(raw, roles))
      return
    }
    setMapLocked(false)
    setRows(parseTakeoff(raw))
  }

  function previewTranspose() {
    if (!roles.includes('qty') || !roles.includes('price')) {
      setNotice('Need both Qty and Unit Price mapped to preview a swap.')
      return
    }
    const swapped = swapQtyPrice(roles)
    setRoles(swapped)
    setMapLocked(false)
    setRows(null)
  }

  function resetMapping() {
    if (!table) return
    setRoles(suggestRoles(table.headers, table.body))
    setMapLocked(false)
    setRows(null)
    setNotice(null)
  }

  function update(i: number, field: 'qty' | 'unit' | 'desc' | 'price' | 'notes', value: string) {
    if (!rows) return
    setRows(rows.map((r, idx) => {
      if (idx !== i) return r
      if (field === 'qty' || field === 'price') return { ...r, [field]: Number(value) || 0 }
      return { ...r, [field]: value }
    }))
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    const name = file.name.toLowerCase()
    try {
      if (name.endsWith('.xls') && !name.endsWith('.xlsx')) {
        throw new Error('Old .xls isn’t supported. Save as .xlsx or .csv, or copy the used range and paste.')
      }
      const text = name.endsWith('.xlsx')
        ? xlsxToTsv(await file.arrayBuffer())
        : stripBom(await file.text())
      applyRaw(text, mode === 'notes' ? 'excel' : mode, file.name)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not read that file.')
    }
  }

  function download(kind: 'xlsx' | 'csv') {
    if (!rows) return
    const totals = { sub, tax, total, taxOn }
    if (kind === 'csv') {
      triggerDownload(linesToCsv(rows, totals), 'text/csv', 'quoteclean-estimate.csv')
      return
    }
    const bytes = linesToXlsx(rows, totals)
    triggerDownload(new Uint8Array(bytes), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'quoteclean-estimate.xlsx')
  }

  const mapped = (role: ColRole) => {
    const i = roles.indexOf(role)
    return i >= 0 && table ? table.headers[i] : null
  }

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto', padding: '28px 18px 64px' }}>
      <div style={badge}>Cal Poly · Vibe Coding Club · student demo — not a PlanSwift plugin</div>
      <h1 style={{ margin: '14px 0 8px', letterSpacing: '-0.02em', fontSize: 'clamp(1.55rem, 3vw, 2.15rem)' }}>
        Stop re-keying PlanSwift takeoff into Excel. Stop transposing qty and price.
      </h1>
      <p style={{ color: '#8b9bb0', maxWidth: '72ch', margin: '0 0 14px' }}>
        You take off in PlanSwift. Then someone types every line into the estimate sheet — and a swapped qty/price is a bad bid.
        Paste pad notes, the office Excel template, or a PlanSwift CSV/XLSX. Confirm columns once. Export a sheet you can drop in
        without retyping descriptions, quantities, or UOMs.
      </p>
      <ol style={steps}>
        <li><b>Takeoff in</b> — notes, Excel template, or PlanSwift export</li>
        <li><b>Lock Qty vs Unit $</b> — no silent column swap</li>
        <li><b>Export to Excel</b> — line items ready; no cell-by-cell re-entry</li>
      </ol>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, marginTop: 8 }}>
        <section style={card}>
          <h2 style={h2}>1. Takeoff in</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <button type="button" style={mode === 'planswift' ? tabOn : tabOff} onClick={() => switchMode('planswift')}>PlanSwift export</button>
            <button type="button" style={mode === 'notes' ? tabOn : tabOff} onClick={() => switchMode('notes')}>Hand notes</button>
            <button type="button" style={mode === 'excel' ? tabOn : tabOff} onClick={() => switchMode('excel')}>Excel template</button>
          </div>
          <p style={{ color: '#8b9bb0', fontSize: 13, margin: '0 0 10px' }}>
            {mode === 'planswift' && 'Paste or upload a PlanSwift-style takeoff dump — counts, linear, areas, assembly, sheet (A2.1). Prices often live on the estimate, not the takeoff.'}
            {mode === 'notes' && 'Type what you wrote on the pad while taking off in PlanSwift. No columns to swap — still check Qty vs Unit $ on the right before export.'}
            {mode === 'excel' && 'Paste rows copied from the office template (tabs or CSV) or upload the .csv / .xlsx. Unit Price often sits next to Qty — confirm the map so they do not swap.'}
          </p>
          <textarea
            value={raw}
            onChange={(e) => onRawChange(e.target.value)}
            style={ta}
            wrap="off"
            spellCheck={false}
            aria-label="Takeoff input"
          />
          {fileLabel && <div style={{ color: '#3dd6c6', fontSize: 12, marginTop: 8 }}>Loaded {fileLabel}</div>}
          {notice && <div style={{ color: '#f0a4a4', fontSize: 13, marginTop: 8 }}>{notice}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" style={ghost} onClick={loadSample}>
              {mode === 'planswift' ? 'Load PlanSwift sample' : mode === 'notes' ? 'Load sample hand notes' : 'Load sample Excel template'}
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
          </div>

          {table && roles.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #2c3848' }}>
              <h2 style={h2}>2. Confirm columns — lock Qty vs Unit $</h2>
              <p style={{ color: '#8b9bb0', fontSize: 13, margin: '0 0 10px' }}>
                {mapLocked
                  ? 'Mapping locked. Change a dropdown to unlock. This is what stops a silent qty/price transpose.'
                  : 'Headers guessed below. If Qty and Unit Price look swapped, fix the dropdowns — do not retype the rows.'}
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {table.headers.map((h, i) => (
                        <th key={i} style={th}>
                          <div style={{ marginBottom: 6, color: '#cfe7ff' }}>{h || `Col ${i + 1}`}</div>
                          <select
                            value={roles[i]}
                            onChange={(e) => {
                              setRoles(setRole(roles, i, e.target.value as ColRole))
                              setMapLocked(false)
                              setRows(null)
                            }}
                            style={sel}
                          >
                            {(Object.keys(ROLE_LABEL) as ColRole[]).map((r) => (
                              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                            ))}
                          </select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.body.slice(0, 4).map((r, ri) => (
                      <tr key={ri}>
                        {r.map((c, ci) => (
                          <td key={ci} style={{ ...td, color: roles[ci] === 'qty' || roles[ci] === 'price' ? '#3dd6c6' : '#8b9bb0' }}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: '#8b9bb0' }}>
                <Chip ok={!!mapped('desc')} label={`Description ← ${mapped('desc') ?? 'unmapped'}`} />
                <Chip ok={!!mapped('qty')} label={`Qty ← ${mapped('qty') ?? 'unmapped'}`} />
                <Chip ok={!!mapped('unit')} label={`UOM ← ${mapped('unit') ?? 'unmapped'}`} />
                <Chip ok={!!mapped('price')} label={`Unit $ ← ${mapped('price') ?? 'not in takeoff (price book)'}`} />
                {mapped('total') && <Chip ok label={`Verify totals ← ${mapped('total')}`} />}
              </div>
              {warnings.map((w) => (
                <div key={w} style={warn}>{w}</div>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <button type="button" style={ghost} onClick={resetMapping}>Reset mapping</button>
                <button type="button" style={ghost} onClick={previewTranspose}>Preview a Qty/Price transpose</button>
                <button type="button" style={primary} onClick={buildEstimate}>
                  Lock columns &amp; build estimate
                </button>
              </div>
            </div>
          )}

          {!table && (
            <div style={{ marginTop: 12 }}>
              <button type="button" style={primary} onClick={buildEstimate}>Build estimate — no re-key</button>
            </div>
          )}
        </section>

        <section style={card}>
          <h2 style={h2}>
            3. Excel-ready estimate {rows ? <span style={{ color: '#5dd39e' }}>· {rows.length} lines</span> : null}
            {warnCount > 0 && <span style={{ color: '#e7c27a' }}> · {warnCount} transpose checks</span>}
          </h2>
          {!rows ? (
            <div style={{ color: '#8b9bb0', padding: '48px 8px', textAlign: 'center' }}>
              Line items land here with descriptions, qty, and UOM already filled — export instead of retyping.
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Qty', 'UOM', 'Description', 'Unit $', 'Total', showVerify ? 'Source total' : null, 'Notes'].filter(Boolean).map((h) => (
                        <th key={h} style={{ ...th, textAlign: h === 'Description' || h === 'Notes' || h === 'UOM' ? 'left' : 'right' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} style={r.warnings.length ? { background: 'rgba(231,194,122,.08)' } : undefined}>
                        <td style={td}><input style={{ ...inpR, ...warnInp(r, 'qty') }} value={r.qty} onChange={(e) => update(i, 'qty', e.target.value)} /></td>
                        <td style={td}><input style={inp} value={r.unit} onChange={(e) => update(i, 'unit', e.target.value)} /></td>
                        <td style={{ ...td, minWidth: 160 }}><input style={inp} value={r.desc} onChange={(e) => update(i, 'desc', e.target.value)} title={r.desc} /></td>
                        <td style={td}><input style={{ ...inpR, ...warnInp(r, 'price') }} value={r.price} onChange={(e) => update(i, 'price', e.target.value)} /></td>
                        <td style={{ ...td, textAlign: 'right', color: '#cfe7ff' }}>{money(r.qty * r.price)}</td>
                        {showVerify && (
                          <td style={{ ...td, textAlign: 'right', color: verifyColor(r) }}>
                            {r.sourceTotal == null ? '—' : money(r.sourceTotal)}
                          </td>
                        )}
                        <td style={{ ...td, minWidth: 88 }}><input style={inp} value={r.notes} onChange={(e) => update(i, 'notes', e.target.value)} title={r.warnings.join(' ')} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.flatMap((r) => r.warnings).slice(0, 4).map((w) => (
                <div key={w} style={{ ...warn, marginTop: 8 }}>{w}</div>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" style={primary} onClick={() => download('xlsx')}>Export to Excel</button>
                <button type="button" style={ghost} onClick={() => download('csv')}>Download CSV</button>
                <button type="button" style={ghost} onClick={() => window.print()}>Print / PDF</button>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#8b9bb0', fontSize: 13 }}>
                  <input type="checkbox" checked={taxOn} onChange={(e) => setTaxOn(e.target.checked)} /> Tax
                  <input style={{ ...inp, width: 64 }} value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value) || 0)} /> %
                </label>
              </div>
              <p style={{ color: '#8b9bb0', fontSize: 12, margin: '10px 0 0' }}>
                Export columns: Item, Description, Qty, UOM, Unit Price, Total, Notes — drop into the office template without re-keying lines.
              </p>
              <div style={{ marginTop: 14, display: 'grid', justifyItems: 'end', gap: 6, color: '#8b9bb0' }}>
                <div style={tot}>Subtotal <b style={{ color: '#e8eef5' }}>{money(sub)}</b></div>
                {taxOn && <div style={tot}>Tax <b style={{ color: '#e8eef5' }}>{money(tax)}</b></div>}
                <div style={{ ...tot, fontSize: '1.15rem', color: '#e8eef5' }}>Grand total <b>{money(total)}</b></div>
              </div>
            </>
          )}
        </section>
      </div>

      <p style={{ marginTop: 22, color: '#8b9bb0', fontSize: 13, maxWidth: '76ch' }}>
        Student MVP by Milo — the job is kill re-key and transpose from PlanSwift takeoff into the estimate.
        Demo: PlanSwift export → confirm Qty vs Unit $ → Export to Excel. Cannot hook PlanSwift/Togal directly; this is the web path that office already has (notes + Excel).
      </p>
    </div>
  )
}

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{
      border: `1px solid ${ok ? 'rgba(61,214,198,.35)' : 'rgba(231,194,122,.45)'}`,
      color: ok ? '#3dd6c6' : '#e7c27a',
      borderRadius: 999, padding: '4px 8px',
    }}>{label}</span>
  )
}

function warnInp(r: Line, field: 'qty' | 'price'): React.CSSProperties {
  if (!r.warnings.length) return {}
  if (field === 'qty' && r.warnings.some((w) => /Qty/i.test(w))) return { borderColor: '#e7c27a' }
  if (field === 'price' && r.warnings.some((w) => /Unit \$|price|transpose/i.test(w))) return { borderColor: '#e7c27a' }
  return r.warnings.length ? { borderColor: 'rgba(231,194,122,.5)' } : {}
}

function verifyColor(r: Line) {
  if (r.sourceTotal == null) return '#8b9bb0'
  const computed = r.qty * r.price
  const ok = Math.abs(computed - r.sourceTotal) <= Math.max(0.51, Math.abs(r.sourceTotal) * 0.04)
  return ok ? '#5dd39e' : '#e7c27a'
}

function triggerDownload(data: BlobPart, type: string, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([data], { type }))
  a.download = name
  a.click()
}

function stripBom(s: string) {
  return s.replace(/^\uFEFF/, '')
}

const badge: React.CSSProperties = {
  display: 'inline-flex', gap: 8, fontSize: 12, color: '#3dd6c6',
  background: 'rgba(61,214,198,.1)', border: '1px solid rgba(61,214,198,.25)',
  padding: '6px 10px', borderRadius: 999,
}
const steps: React.CSSProperties = {
  color: '#cfe7ff', fontSize: 13, paddingLeft: 18, margin: '0 0 18px', maxWidth: '70ch',
}
const card: React.CSSProperties = {
  background: 'linear-gradient(180deg,#1a222c,#161c24)', border: '1px solid #2c3848',
  borderRadius: 16, padding: 16, boxShadow: '0 10px 40px rgba(0,0,0,.25)',
}
const h2: React.CSSProperties = { margin: '0 0 10px', fontSize: 12, color: '#8b9bb0', letterSpacing: '.06em', textTransform: 'uppercase' }
const ta: React.CSSProperties = {
  width: '100%', minHeight: 220, resize: 'vertical', background: '#232d3a', color: '#e8eef5',
  border: '1px solid #2c3848', borderRadius: 12, padding: 14, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13,
  whiteSpace: 'pre', overflowX: 'auto',
}
const primary: React.CSSProperties = { border: 0, borderRadius: 10, padding: '11px 16px', fontWeight: 600, cursor: 'pointer', background: 'linear-gradient(135deg,#3dd6c6,#2bb3c4)', color: '#06201d' }
const ghost: React.CSSProperties = { borderRadius: 10, padding: '11px 16px', fontWeight: 600, cursor: 'pointer', background: 'transparent', color: '#e8eef5', border: '1px solid #2c3848' }
const tabOn: React.CSSProperties = { ...ghost, borderColor: '#3dd6c6', color: '#3dd6c6' }
const tabOff: React.CSSProperties = ghost
const th: React.CSSProperties = { padding: '10px 8px', borderBottom: '1px solid #2c3848', color: '#8b9bb0', fontSize: 11, textTransform: 'none', letterSpacing: '.02em', verticalAlign: 'bottom' }
const td: React.CSSProperties = { padding: '6px 4px', borderBottom: '1px solid #2c3848' }
const inp: React.CSSProperties = { width: '100%', background: 'transparent', border: '1px solid transparent', color: '#e8eef5', borderRadius: 6, padding: '6px 8px' }
const inpR: React.CSSProperties = { ...inp, textAlign: 'right' }
const tot: React.CSSProperties = { display: 'flex', gap: 24, minWidth: 240, justifyContent: 'space-between' }
const sel: React.CSSProperties = {
  width: '100%', background: '#232d3a', color: '#e8eef5', border: '1px solid #2c3848',
  borderRadius: 8, padding: '4px 6px', fontSize: 11,
}
const warn: React.CSSProperties = {
  marginTop: 8, fontSize: 12, color: '#e7c27a',
  background: 'rgba(231,194,122,.08)', border: '1px solid rgba(231,194,122,.25)',
  borderRadius: 8, padding: '8px 10px',
}
