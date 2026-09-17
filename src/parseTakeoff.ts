export type Line = { qty: number; unit: string; desc: string; price: number }

const BOOK: Record<string, number> = {
  drywall: 18.5, mud: 14, stud: 4.25, insulation: 32, paint: 38,
  labor: 55, baseboard: 1.85, door: 145, hardware: 28, dumpster: 475,
  cleanup: 55, fastener: 125,
}

const UNIT_TOKEN =
  'sheets?|sht|bags?|buckets?|bkt|sets?|hrs?|hours|hr|lf|sf|sy|cy|gal|ea|each|pcs|ls|lin|sqft|uom'

export function guessPrice(desc: string) {
  const d = desc.toLowerCase()
  for (const [k, v] of Object.entries(BOOK)) if (d.includes(k)) return v
  if (/hr|labor|crew/.test(d)) return 55
  return 0
}

export function norm(u: string) {
  u = (u || 'ea').toLowerCase().replace(/\./g, '')
  if (/sheet|sht/.test(u)) return 'sheets'
  if (/hr|hour/.test(u)) return 'hrs'
  if (/bag/.test(u)) return 'bags'
  if (/bucket|bkt/.test(u)) return 'buckets'
  if (/set/.test(u)) return 'sets'
  if (/each|ea|pcs/.test(u)) return 'ea'
  if (/^lin$/.test(u)) return 'lf'
  if (/sqft/.test(u)) return 'sf'
  if (/^uom$/.test(u)) return 'ea'
  return u
}

export function looksTabular(text: string): boolean {
  const lines = nonemptyLines(text)
  if (lines.length < 2) return false
  const sample = lines.slice(0, Math.min(8, lines.length))
  const tabbed = sample.filter((l) => (l.match(/\t/g) || []).length >= 2)
  if (tabbed.length >= Math.min(2, sample.length)) return true
  const first = stripBom(lines[0] ?? '').toLowerCase()
  if (
    /[,;]/.test(lines[0] ?? '') &&
    /(qty|quantity|description|desc|uom|unit|item)/.test(first)
  ) {
    return true
  }
  return false
}

export function parseTakeoff(text: string): Line[] {
  const lines = looksTabular(text) ? parseTabular(text) : parseNotes(text)
  return applyWaste(text, lines)
}

function nonemptyLines(text: string): string[] {
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim())
}

function stripBom(s: string) {
  return s.replace(/^\uFEFF/, '')
}

function parseNotes(text: string): Line[] {
  const lines: Line[] = []
  const skip =
    /^(note:|kitchen|takeoff|planswift|counted |wrote these|sheet a\d)/i
  const unitRe = new RegExp(
    `(.+?)\\s+(\\d+(?:\\.\\d+)?)\\s*(${UNIT_TOKEN})\\b(?:\\s*[~@]?\\s*\\$?(\\d+(?:\\.\\d+)?)(?:\\/\\w+)?)?`,
    'i',
  )

  for (const raw of text.split(/\n/)) {
    let line = raw.replace(/^[-*•]\s*/, '').trim()
    if (!line || skip.test(line)) continue

    let m = line.match(
      new RegExp(
        `(.+?)\\s+(\\d+(?:\\.\\d+)?)\\s*(${UNIT_TOKEN})?\\s*(?:@|at)\\s*\\$?(\\d+(?:\\.\\d+)?)`,
        'i',
      ),
    )
    if (m) {
      lines.push({
        desc: m[1]!.trim(),
        qty: +m[2]!,
        unit: norm(m[3] || 'ea'),
        price: +m[4]!,
      })
      continue
    }
    m = line.match(/(.+?)\s+x\s*(\d+)\s*\$?(\d+(?:\.\d+)?)?/i)
    if (m) {
      lines.push({
        desc: m[1]!.trim(),
        qty: +m[2]!,
        unit: 'ea',
        price: m[3] ? +m[3] : guessPrice(m[1]!),
      })
      continue
    }
    m = line.match(unitRe)
    if (m) {
      lines.push({
        desc: m[1]!.trim(),
        qty: +m[2]!,
        unit: norm(m[3]!),
        price: m[4] ? +m[4] : guessPrice(m[1]!),
      })
      continue
    }
    m = line.match(/(.+?)\s+(\d+(?:\.\d+)?)\s+\$?(\d+(?:\.\d+)?)\s*$/)
    if (m && !new RegExp(`\\b(?:${UNIT_TOKEN})\\b`, 'i').test(line)) {
      const qty = +m[2]!
      const price = +m[3]!
      const desc = m[1]!.trim()
      if (/allowance|misc|fastener|dumpster/i.test(desc) || (qty <= 12 && price >= 50)) {
        lines.push({
          desc,
          qty,
          unit: /allowance|dumpster|misc/i.test(desc) ? 'ls' : 'ea',
          price,
        })
        continue
      }
    }
    m = line.match(/(.+?)\s+(\d+(?:\.\d+)?)\s*$/)
    if (m) {
      const n = +m[2]!
      if (/allowance|misc|fastener|dumpster/i.test(m[1]!) || n >= 50) {
        lines.push({ desc: m[1]!.trim(), qty: 1, unit: 'ls', price: n })
      } else {
        lines.push({ desc: m[1]!.trim(), qty: n, unit: 'ea', price: guessPrice(m[1]!) })
      }
      continue
    }
    if (/waste|cleanup/i.test(line)) {
      lines.push({ desc: line, qty: 1, unit: 'ls', price: guessPrice(line) })
    }
  }
  return lines
}

function parseTabular(text: string): Line[] {
  const rows = splitTable(text)
  if (rows.length === 0) return parseNotes(text)

  const header = rows[0]!.map((h) => h.trim())
  const map = headerMap(header)
  const body = map ? rows.slice(1) : rows
  const layout = map ?? inferLayout(body)
  const out: Line[] = []

  for (const cols of body) {
    const desc = pick(cols, layout.desc).replace(/^[-*•]\s*/, '').trim()
    if (!desc || /^(note:|notes?|total|subtotal|grand total)/i.test(desc)) continue
    if (/^item$|^#+$/i.test(desc)) continue

    const qtyRaw = pick(cols, layout.qty)
    const unitRaw = pick(cols, layout.unit)
    const priceRaw = pick(cols, layout.price)
    const qty = parseNum(qtyRaw)
    const priceParsed = parseNum(priceRaw)
    const notes = layout.notes != null ? pick(cols, layout.notes) : ''

    if (qty == null && !unitRaw && priceParsed == null) continue

    const lineDesc = notes && /missing|waste|allowance|verify|no rate/i.test(notes)
      ? `${desc} — ${notes}`
      : desc

    out.push({
      desc: lineDesc,
      qty: qty ?? 1,
      unit: norm(unitRaw || (qty == null && priceParsed != null ? 'ls' : 'ea')),
      price: priceParsed ?? guessPrice(desc),
    })
  }
  return out.length ? out : parseNotes(text)
}

type ColMap = { qty: number; unit: number; desc: number; price: number; notes?: number }

function headerMap(header: string[]): ColMap | null {
  const idx: Partial<ColMap> & { desc?: number } = {}
  header.forEach((h, i) => {
    const x = h.toLowerCase().replace(/[^a-z0-9$]+/g, ' ').trim()
    if (!x) return
    if (/^(item|#|no|num|number|line|code)$/.test(x) || /^item (no|num|number|#)/.test(x)) return
    if (/(^| )(ext|extended|total|amount)( |$)/.test(x) && !/unit/.test(x)) return
    if (/qty|quantity|count|takeoff/.test(x)) idx.qty = i
    else if (/^(uom|um|units?)$/.test(x) || /^unit(s| of measure)?$/.test(x)) idx.unit = i
    else if (/price|rate|cost|unit \$/.test(x)) idx.price = i
    else if (/desc|item name|material|work|scope/.test(x) || x === 'item') idx.desc ??= i
    else if (/note/.test(x)) idx.notes = i
  })
  if (idx.desc == null) {
    const named = header.findIndex((h, i) => i !== idx.qty && i !== idx.unit && i !== idx.price && h.trim())
    if (named >= 0) idx.desc = named
  }
  if (idx.desc == null) return null
  return {
    qty: idx.qty ?? -1,
    unit: idx.unit ?? -1,
    desc: idx.desc,
    price: idx.price ?? -1,
    notes: idx.notes,
  }
}

function inferLayout(rows: string[][]): ColMap {
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0)
  // item#, desc, qty, unit, price  OR  desc, qty, unit, price
  const probe = rows.find((r) => r.some((c) => c.trim())) ?? []
  const c0 = probe[0]?.trim() ?? ''
  if (width >= 4 && /^\d{1,4}$/.test(c0)) {
    return { desc: 1, qty: 2, unit: 3, price: 4 }
  }
  if (width >= 4) return { desc: 0, qty: 1, unit: 2, price: 3 }
  if (width === 3) return { desc: 0, qty: 1, unit: 2, price: -1 }
  return { desc: 0, qty: 1, unit: -1, price: 2 }
}

function pick(cols: string[], i: number) {
  if (i < 0) return ''
  return (cols[i] ?? '').trim()
}

function parseNum(s: string): number | null {
  if (!s) return null
  const t = s.replace(/[$,\s]/g, '').replace(/~$/, '')
  if (!t || !/^-?\d+(\.\d+)?$/.test(t)) return null
  return Number(t)
}

function splitTable(text: string): string[][] {
  const lines = nonemptyLines(text)
  if (!lines.length) return []
  const delim = detectDelim(lines)
  return lines.map((l) => splitDelimitedLine(stripBom(l), delim))
}

function detectDelim(lines: string[]): string {
  const first = stripBom(lines[0] ?? '')
  if (first.includes('\t')) return '\t'
  const commas = (first.match(/,/g) || []).length
  const semis = (first.match(/;/g) || []).length
  return semis > commas ? ';' : ','
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

function applyWaste(text: string, lines: Line[]): Line[] {
  if (!/10%\s*waste|waste.*drywall|drywall.*waste/i.test(text)) return lines
  if (lines.some((l) => /waste allowance/i.test(l.desc))) return lines
  const dw = lines.filter((l) => /drywall|sheetrock|gwb/i.test(l.desc) && /sheet/i.test(l.unit))
  const material = dw.reduce((s, l) => s + l.qty * l.price, 0)
  if (material > 0) {
    lines.push({
      qty: 1,
      unit: 'ls',
      desc: 'Drywall waste allowance (10%)',
      price: +(material * 0.1).toFixed(2),
    })
  }
  return lines
}
