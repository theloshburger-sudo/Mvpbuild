import type { ColRole, Line, TableData } from './types'
import { UNIQUE_ROLES } from './types'
import { guessPrice, norm } from './units'

const UNIT_WORDS = /^(sheets?|sht|bags?|buckets?|bkt|sets?|hrs?|hours|hr|lf|sf|sy|cy|gal|ea|each|pcs|ls|lin|sqft|uom|units?)$/i

export function parseNum(s: string): number | null {
  if (!s) return null
  const t = s.replace(/[$,\s]/g, '').replace(/~$/, '')
  if (!t || !/^-?\d+(\.\d+)?$/.test(t)) return null
  return Number(t)
}

export function looksLikeMoney(raw: string): boolean {
  const s = raw.trim()
  if (!s) return false
  if (/^\$/.test(s)) return true
  const n = parseNum(s)
  if (n == null || n <= 0) return false
  return /\.\d{2}$/.test(s.replace(/[$,]/g, ''))
}

export function looksLikeCount(raw: string): boolean {
  const s = raw.trim()
  if (!s || /\$/.test(s)) return false
  const n = parseNum(s)
  if (n == null || n < 0) return false
  const t = s.replace(/[,\s]/g, '')
  if (/^\d+(\.0+)?$/.test(t)) return true
  return !/\.\d{2}$/.test(t) && n < 10000
}

export function splitDelimitedLine(line: string, delim: string): string[] {
  if (delim === '\t') return line.split('\t').map((s) => s.trim())
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"'
        i++
        continue
      }
      inQ = !inQ
      continue
    }
    if (ch === delim && !inQ) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur.trim())
  return out
}

export function parseTable(text: string): TableData | null {
  const lines = nonemptyLines(text)
  if (lines.length < 2) return null
  const delim = detectDelim(lines)
  const rows = lines.map((l) => splitDelimitedLine(stripBom(l), delim))
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0)
  if (width < 3) return null
  const padded = rows.map((r) => {
    const next = r.slice()
    while (next.length < width) next.push('')
    return next
  })
  const hasHeader = firstRowIsHeader(padded[0]!)
  const headers = hasHeader
    ? padded[0]!.map((h, i) => h || `Column ${colLetter(i)}`)
    : padded[0]!.map((_, i) => `Column ${colLetter(i)}`)
  const body = hasHeader ? padded.slice(1) : padded
  return { headers, body, hasHeader }
}

export function looksTabular(text: string): boolean {
  return parseTable(text) != null && (countTabs(text) >= 2 || headerish(text))
}

function countTabs(text: string) {
  const lines = nonemptyLines(text).slice(0, 8)
  return lines.filter((l) => (l.match(/\t/g) || []).length >= 2).length
}

function headerish(text: string) {
  const first = nonemptyLines(text)[0]?.toLowerCase() ?? ''
  return /[,;]/.test(first) && /(qty|quantity|description|desc|uom|unit|item|name|takeoff)/.test(first)
}

export function suggestRoles(headers: string[], body: string[][]): ColRole[] {
  const width = headers.length
  const roles: ColRole[] = Array.from({ length: width }, () => 'ignore')
  const taken = new Set<ColRole>()
  const scores = scoreColumns(body, width)

  headers.forEach((h, i) => {
    const role = roleFromHeader(h)
    if (role === 'ignore' || taken.has(role)) return
    roles[i] = role
    taken.add(role)
  })

  // PlanSwift "Item" is the takeoff name, not a line number.
  const itemAt = roles.indexOf('item')
  if (itemAt >= 0 && !taken.has('desc')) {
    if ((scores[itemAt]?.text ?? 0) > 0.5 && (scores[itemAt]?.count ?? 0) < 0.35) {
      roles[itemAt] = 'desc'
      taken.delete('item')
      taken.add('desc')
    }
  }

  fillRole(roles, taken, 'desc', scores.map((s) => s.text))
  fillRole(roles, taken, 'unit', scores.map((s) => s.unit))
  fillRole(roles, taken, 'price', scores.map((s) => s.money))
  fillRole(roles, taken, 'qty', scores.map((s) => s.count))
  fillRole(roles, taken, 'total', scores.map((s) => s.totalish))
  fillRole(roles, taken, 'notes', scores.map((s) => s.notes))
  fillRole(roles, taken, 'sheet', scores.map((s) => s.sheet))

  // Never leave Qty on a money-like column if a count-like column is free.
  const qtyAt = roles.indexOf('qty')
  const priceAt = roles.indexOf('price')
  if (qtyAt >= 0 && scores[qtyAt]!.money > scores[qtyAt]!.count + 0.15) {
    const better = scores
      .map((s, i) => ({ i, s }))
      .filter((x) => roles[x.i] === 'ignore' || roles[x.i] === 'total')
      .sort((a, b) => b.s.count - a.s.count)[0]
    if (better && better.s.count > 0.3) {
      if (roles[better.i] === 'total') roles[better.i] = 'ignore'
      roles[qtyAt] = priceAt < 0 ? 'price' : 'ignore'
      roles[better.i] = 'qty'
    }
  }
  return roles
}

export function setRole(roles: ColRole[], index: number, role: ColRole): ColRole[] {
  const next = roles.slice()
  if (role !== 'ignore' && UNIQUE_ROLES.includes(role)) {
    for (let i = 0; i < next.length; i++) {
      if (i !== index && next[i] === role) next[i] = 'ignore'
    }
  }
  next[index] = role
  return next
}

export function swapQtyPrice(roles: ColRole[]): ColRole[] {
  const next = roles.slice()
  const q = next.indexOf('qty')
  const p = next.indexOf('price')
  if (q < 0 || p < 0) return next
  next[q] = 'price'
  next[p] = 'qty'
  return next
}

export function mappingWarnings(headers: string[], body: string[][], roles: ColRole[]): string[] {
  const msgs: string[] = []
  const qtyAt = roles.indexOf('qty')
  const priceAt = roles.indexOf('price')
  const totalAt = roles.indexOf('total')
  const descAt = roles.indexOf('desc')
  const data = body.filter((r) => !isSkipRow(r, descAt))

  if (descAt < 0) msgs.push('No Description column mapped — lock a text column so you do not re-type names.')
  if (qtyAt < 0) msgs.push('No Qty column mapped — that is how takeoff quantities get re-keyed by hand.')

  if (qtyAt >= 0) {
    const moneyFrac = frac(data, (r) => looksLikeMoney(r[qtyAt] ?? ''))
    if (moneyFrac >= 0.35) {
      msgs.push('Qty column looks like money (2-decimal / $). That is a classic Qty ↔ Unit Price transpose.')
    }
  }
  if (priceAt >= 0) {
    const countFrac = frac(data, (r) => looksLikeCount(r[priceAt] ?? '') && !looksLikeMoney(r[priceAt] ?? ''))
    const moneyFrac = frac(data, (r) => looksLikeMoney(r[priceAt] ?? ''))
    if (countFrac >= 0.5 && moneyFrac < 0.2) {
      msgs.push('Unit Price column looks like takeoff counts, not dollars. Confirm before you lock.')
    }
  }
  if (qtyAt >= 0 && priceAt >= 0) {
    const qtyMoney = frac(data, (r) => looksLikeMoney(r[qtyAt] ?? ''))
    const priceCount = frac(data, (r) => looksLikeCount(r[priceAt] ?? '') && !looksLikeMoney(r[priceAt] ?? ''))
    if (qtyMoney >= 0.35 && priceCount >= 0.45) {
      msgs.push('Columns look swapped: Qty is prices and Unit Price is counts. Use the dropdowns — do not retype the rows.')
    }
  }
  if (qtyAt >= 0 && priceAt >= 0 && totalAt >= 0) {
    let mismatch = 0
    let compared = 0
    for (const r of data) {
      const q = parseNum(r[qtyAt] ?? '')
      const p = parseNum(r[priceAt] ?? '')
      const t = parseNum(r[totalAt] ?? '')
      if (q == null || p == null || t == null || t === 0) continue
      compared++
      const computed = q * p
      if (Math.abs(computed - t) > Math.max(0.51, Math.abs(t) * 0.04)) mismatch++
    }
    if (compared >= 2 && mismatch / compared >= 0.3) {
      msgs.push(`${mismatch}/${compared} rows: Qty × Unit Price ≠ Total. Wrong column map — totals are how you catch it.`)
    }
  }
  if (qtyAt >= 0 && roles[qtyAt] === 'qty' && /total|ext|amount|price|cost/i.test(headers[qtyAt] ?? '')) {
    msgs.push(`Qty is mapped to “${headers[qtyAt]}” — that header is not a takeoff quantity.`)
  }
  if (priceAt >= 0 && /qty|quantity|count|takeoff/i.test(headers[priceAt] ?? '')) {
    msgs.push(`Unit Price is mapped to “${headers[priceAt]}” — likely a transpose waiting to happen.`)
  }
  return msgs
}

export function rowsToLines(body: string[][], roles: ColRole[]): Line[] {
  const descAt = roles.indexOf('desc')
  const qtyAt = roles.indexOf('qty')
  const unitAt = roles.indexOf('unit')
  const priceAt = roles.indexOf('price')
  const notesAt = roles.indexOf('notes')
  const sheetAt = roles.indexOf('sheet')
  const totalAt = roles.indexOf('total')
  const out: Line[] = []

  for (const cols of body) {
    if (isSkipRow(cols, descAt)) continue
    const desc = (descAt >= 0 ? cols[descAt] : cols.find((c) => c && parseNum(c) == null))?.replace(/^[-*•]\s*/, '').trim() ?? ''
    if (!desc) continue

    const qtyRaw = qtyAt >= 0 ? cols[qtyAt] ?? '' : ''
    const priceRaw = priceAt >= 0 ? cols[priceAt] ?? '' : ''
    const unitRaw = unitAt >= 0 ? cols[unitAt] ?? '' : ''
    const sheet = sheetAt >= 0 ? (cols[sheetAt] ?? '').trim() : ''
    const noteRaw = notesAt >= 0 ? (cols[notesAt] ?? '').trim() : ''
    const qty = parseNum(qtyRaw)
    const priceParsed = parseNum(priceRaw)
    const sourceTotal = totalAt >= 0 ? parseNum(cols[totalAt] ?? '') : null
    if (qty == null && !unitRaw && priceParsed == null) continue

    const notes = [sheet && /^[A-Z]?\d/i.test(sheet) ? `PS ${sheet}` : sheet, noteRaw]
      .filter(Boolean)
      .join(' · ')

    const line: Line = {
      desc,
      qty: qty ?? 1,
      unit: norm(unitRaw || (qty == null && priceParsed != null ? 'ls' : 'ea')),
      price: priceParsed ?? guessPrice(desc),
      notes,
      sourceTotal,
      warnings: [],
    }
    line.warnings = rowWarnings(line, qtyRaw, priceRaw)
    out.push(line)
  }
  return out
}

function rowWarnings(line: Line, qtyRaw: string, priceRaw: string): string[] {
  const w: string[] = []
  if (looksLikeMoney(qtyRaw) && looksLikeCount(priceRaw) && !looksLikeMoney(priceRaw)) {
    w.push('Qty looks like a unit price and Unit $ looks like a count — possible transpose.')
  }
  const countUnit = /^(ea|set|sets|hrs|hr|gal|bags|sheets|ls)$/.test(line.unit)
  if (
    countUnit &&
    line.qty >= 40 &&
    line.price > 0 &&
    line.price <= 15 &&
    /door|dumpster|hardware|labor|gwb|drywall|paint labor/i.test(line.desc)
  ) {
    w.push('Qty is large and Unit $ is cheap for this item — check a swapped 6 @ 145 vs 145 @ 6.')
  }
  if (line.sourceTotal != null && line.sourceTotal !== 0) {
    const computed = line.qty * line.price
    if (Math.abs(computed - line.sourceTotal) > Math.max(0.51, Math.abs(line.sourceTotal) * 0.04)) {
      w.push(`Qty × Unit $ = ${computed.toFixed(2)} but source total is ${line.sourceTotal.toFixed(2)}.`)
    }
  }
  return w
}

function roleFromHeader(h: string): ColRole {
  const x = h.toLowerCase().replace(/[^a-z0-9$]+/g, ' ').trim()
  if (!x) return 'ignore'
  if (/^(item|#|no|num|number|line|code)$/.test(x) || /^item (no|num|number|#)/.test(x)) return 'item'
  if (/^(type|folder|layer|drawing|properties|prop)$/.test(x)) return 'ignore'
  if (/(^| )(ext|extended|amount)( |$)/.test(x) || /^(total|ext cost|extended cost)$/.test(x)) return 'total'
  if (/qty|quantity/.test(x) || /^(takeoff|result)$/.test(x) || x === 'count') return 'qty'
  if (/takeoff/.test(x)) return 'qty'
  if (/^(uom|um|units?)$/.test(x) || /^unit(s| of measure)?$/.test(x)) return 'unit'
  if (/price|rate|unit \$|unit cost/.test(x) || /^(cost)$/.test(x)) return 'price'
  if (/^(name|item name|description|desc|material|work|scope)$/.test(x) || /desc/.test(x)) return 'desc'
  if (/^(page|page name|sheet|drawing no)$/.test(x) || /page name/.test(x)) return 'sheet'
  if (/note|comment/.test(x)) return 'notes'
  return 'ignore'
}

function scoreColumns(body: string[][], width: number) {
  const cols = Array.from({ length: width }, () => ({
    text: 0, unit: 0, money: 0, count: 0, totalish: 0, notes: 0, sheet: 0, n: 0,
  }))
  for (const row of body) {
    for (let i = 0; i < width; i++) {
      const cell = (row[i] ?? '').trim()
      if (!cell) continue
      const s = cols[i]!
      s.n++
      if (parseNum(cell) == null && !UNIT_WORDS.test(cell)) s.text++
      if (UNIT_WORDS.test(cell)) s.unit++
      if (looksLikeMoney(cell)) s.money++
      if (looksLikeCount(cell)) s.count++
      if (/waste|missing|verify|note:/i.test(cell)) s.notes++
      if (/^[A-Z]?\d+\.\d+$/i.test(cell) || /^A\d/i.test(cell)) s.sheet++
    }
  }
  return cols.map((s) => ({
    text: s.n ? s.text / s.n : 0,
    unit: s.n ? s.unit / s.n : 0,
    money: s.n ? s.money / s.n : 0,
    count: s.n ? s.count / s.n : 0,
    totalish: s.n ? s.money / s.n : 0,
    notes: s.n ? s.notes / s.n : 0,
    sheet: s.n ? s.sheet / s.n : 0,
  }))
}

function fillRole(roles: ColRole[], taken: Set<ColRole>, role: ColRole, scores: number[]) {
  if (taken.has(role)) return
  let best = -1
  let bestScore = role === 'desc' ? 0.25 : 0.35
  for (let i = 0; i < roles.length; i++) {
    if (roles[i] !== 'ignore') continue
    const sc = scores[i] ?? 0
    if (sc > bestScore) {
      bestScore = sc
      best = i
    }
  }
  if (best >= 0) {
    roles[best] = role
    taken.add(role)
  }
}

function firstRowIsHeader(row: string[]): boolean {
  const joined = row.join(' ').toLowerCase()
  if (/qty|quantity|description|desc|uom|unit|item|name|takeoff|price|folder/.test(joined)) return true
  const nums = row.filter((c) => parseNum(c) != null).length
  return nums <= Math.max(1, row.length / 3)
}

function isSkipRow(cols: string[], descAt: number) {
  const desc = (descAt >= 0 ? cols[descAt] : cols[0] ?? '').trim()
  if (!desc) return true
  if (/^(note:|notes?|total|subtotal|grand total)$/i.test(desc)) return true
  if (/^note:/i.test(desc)) return true
  if (/^item$|^#+$/i.test(desc)) return true
  return false
}

function frac(rows: string[][], pred: (r: string[]) => boolean) {
  const usable = rows.filter((r) => r.some((c) => c.trim()))
  if (!usable.length) return 0
  return usable.filter(pred).length / usable.length
}

function nonemptyLines(text: string): string[] {
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim())
}

function stripBom(s: string) {
  return s.replace(/^\uFEFF/, '')
}

function detectDelim(lines: string[]): string {
  const first = stripBom(lines[0] ?? '')
  if (first.includes('\t')) return '\t'
  const commas = (first.match(/,/g) || []).length
  const semis = (first.match(/;/g) || []).length
  return semis > commas ? ';' : ','
}

function colLetter(i: number) {
  let n = i + 1
  let s = ''
  while (n) {
    n--
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26)
  }
  return s
}
