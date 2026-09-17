import { parseTable, rowsToLines } from './columns'
import type { ColRole, Line } from './types'
import { guessPrice, norm } from './units'

export type { Line } from './types'
export { guessPrice, norm }

const UNIT_TOKEN =
  'sheets?|sht|bags?|buckets?|bkt|sets?|hrs?|hours|hr|lf|sf|sy|cy|gal|ea|each|pcs|ls|lin|sqft|uom'

export function parseTakeoff(text: string, roles?: ColRole[]): Line[] {
  const table = parseTable(text)
  if (table && roles?.some((r) => r !== 'ignore')) {
    return applyWaste(text, rowsToLines(table.body, roles))
  }
  return applyWaste(text, parseNotes(text))
}

export function parseNotes(text: string): Line[] {
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
      lines.push(makeLine(m[1]!.trim(), +m[2]!, norm(m[3] || 'ea'), +m[4]!))
      continue
    }
    m = line.match(/(.+?)\s+x\s*(\d+)\s*\$?(\d+(?:\.\d+)?)?/i)
    if (m) {
      lines.push(makeLine(m[1]!.trim(), +m[2]!, 'ea', m[3] ? +m[3] : guessPrice(m[1]!)))
      continue
    }
    m = line.match(unitRe)
    if (m) {
      lines.push(makeLine(m[1]!.trim(), +m[2]!, norm(m[3]!), m[4] ? +m[4] : guessPrice(m[1]!)))
      continue
    }
    m = line.match(/(.+?)\s+(\d+(?:\.\d+)?)\s+\$?(\d+(?:\.\d+)?)\s*$/)
    if (m && !new RegExp(`\\b(?:${UNIT_TOKEN})\\b`, 'i').test(line)) {
      const qty = +m[2]!
      const price = +m[3]!
      const desc = m[1]!.trim()
      if (/allowance|misc|fastener|dumpster/i.test(desc) || (qty <= 12 && price >= 50)) {
        lines.push(makeLine(desc, qty, /allowance|dumpster|misc/i.test(desc) ? 'ls' : 'ea', price))
        continue
      }
    }
    m = line.match(/(.+?)\s+(\d+(?:\.\d+)?)\s*$/)
    if (m) {
      const n = +m[2]!
      if (/allowance|misc|fastener|dumpster/i.test(m[1]!) || n >= 50) {
        lines.push(makeLine(m[1]!.trim(), 1, 'ls', n))
      } else {
        lines.push(makeLine(m[1]!.trim(), n, 'ea', guessPrice(m[1]!)))
      }
      continue
    }
    if (/waste|cleanup/i.test(line)) {
      lines.push(makeLine(line, 1, 'ls', guessPrice(line)))
    }
  }
  return lines
}

export function applyWaste(text: string, lines: Line[]): Line[] {
  if (!/10%\s*waste|waste.*drywall|drywall.*waste|waste on (drywall|gwb)/i.test(text)) return lines
  if (lines.some((l) => /waste allowance/i.test(l.desc))) return lines
  const dw = lines.filter((l) => /drywall|sheetrock|gwb/i.test(l.desc) && /sheet|ea/i.test(l.unit))
  const material = dw.reduce((s, l) => s + l.qty * l.price, 0)
  if (material > 0) {
    lines.push(makeLine('Drywall waste allowance (10%)', 1, 'ls', +(material * 0.1).toFixed(2)))
  }
  return lines
}

function makeLine(desc: string, qty: number, unit: string, price: number): Line {
  return { desc, qty, unit, price, notes: '', sourceTotal: null, warnings: [] }
}
