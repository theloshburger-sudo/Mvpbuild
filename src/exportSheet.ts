import { zipSync, strToU8 } from 'fflate'
import type { Line } from './types'

export type SheetTotals = { sub: number; tax: number; total: number; taxOn: boolean }

const HEADERS = ['Item', 'Description', 'Qty', 'UOM', 'Unit Price', 'Total', 'Notes']

export function linesToCsv(lines: Line[], totals: SheetTotals): string {
  const rows = [
    HEADERS,
    ...lines.map((l, i) => [
      String(i + 1),
      l.desc,
      String(l.qty),
      l.unit,
      l.price.toFixed(2),
      (l.qty * l.price).toFixed(2),
      l.notes,
    ]),
    [],
    ['', 'Subtotal', '', '', '', totals.sub.toFixed(2), ''],
    ...(totals.taxOn ? [['', 'Tax', '', '', '', totals.tax.toFixed(2), '']] : []),
    ['', 'Grand total', '', '', '', totals.total.toFixed(2), 'Verify Qty vs Unit Price before pasting into the office template'],
  ]
  return rows.map((r) => r.map(csvCell).join(',')).join('\n')
}

export function linesToXlsx(lines: Line[], totals: SheetTotals): Uint8Array {
  const sheetRows: string[][] = [
    ['QuoteClean estimate — from PlanSwift takeoff. Not re-keyed. Confirm Qty vs Unit Price.'],
    HEADERS,
    ...lines.map((l, i) => [
      String(i + 1),
      l.desc,
      String(l.qty),
      l.unit,
      l.price.toFixed(2),
      (l.qty * l.price).toFixed(2),
      l.notes,
    ]),
    [],
    ['', 'Subtotal', '', '', '', totals.sub.toFixed(2), ''],
  ]
  if (totals.taxOn) sheetRows.push(['', 'Tax', '', '', '', totals.tax.toFixed(2), ''])
  sheetRows.push(['', 'Grand total', '', '', '', totals.total.toFixed(2), 'Verify Qty vs Unit Price — do not transpose'])

  const sheet = worksheetXml(sheetRows)
  return zipSync({
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8(RELS),
    'xl/workbook.xml': strToU8(WORKBOOK),
    'xl/_rels/workbook.xml.rels': strToU8(WB_RELS),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
  })
}

function csvCell(v: string) {
  return `"${v.replace(/"/g, '""')}"`
}

function worksheetXml(rows: string[][]): string {
  const body = rows.map((row, ri) => {
    const r = ri + 1
    const cells = row.map((val, ci) => {
      const ref = `${colLetter(ci)}${r}`
      if (val === '') return ''
      const n = Number(val)
      if (val !== '' && Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(val)) {
        return `<c r="${ref}"><v>${val}</v></c>`
      }
      return `<c r="${ref}" t="inlineStr"><is><t>${xml(val)}</t></is></c>`
    }).join('')
    return `<row r="${r}">${cells}</row>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`
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

function xml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Estimate" sheetId="1" r:id="rId1"/></sheets>
</workbook>`

const WB_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`
