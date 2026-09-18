import { zipSync, strToU8 } from 'fflate'
import type { Line } from './types'

export type SheetTotals = { sub: number; tax: number; total: number; taxOn: boolean }
export type SheetMeta = { dateLabel: string }

const HEADERS = ['Item', 'Description', 'Qty', 'UOM', 'Unit Price', 'Total', 'Notes']

export function linesToCsv(lines: Line[], totals: SheetTotals, meta?: SheetMeta): string {
  const rows = [
    ['QuoteClean estimate', meta?.dateLabel ?? '', 'Confirm Qty vs Unit Price — do not re-key'],
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
    ['', 'Grand total', '', '', '', totals.total.toFixed(2), 'Map these columns into the office template'],
  ]
  return rows.map((r) => r.map(csvCell).join(',')).join('\n')
}

export function linesToXlsx(lines: Line[], totals: SheetTotals, meta?: SheetMeta): Uint8Array {
  const dateLabel = meta?.dateLabel ?? ''
  const subRow = 2 + lines.length + 2
  const taxRow = totals.taxOn ? subRow + 1 : subRow
  const grandRow = totals.taxOn ? taxRow + 1 : subRow + 1
  const estimate = estimateSheetXml(lines, totals, dateLabel, subRow, taxRow, grandRow)
  const guide = guideSheetXml(dateLabel)

  return zipSync({
    '[Content_Types].xml': strToU8(contentTypes()),
    '_rels/.rels': strToU8(RELS),
    'xl/workbook.xml': strToU8(WORKBOOK),
    'xl/_rels/workbook.xml.rels': strToU8(WB_RELS),
    'xl/styles.xml': strToU8(STYLES),
    'xl/worksheets/sheet1.xml': strToU8(estimate),
    'xl/worksheets/sheet2.xml': strToU8(guide),
  })
}

function estimateSheetXml(
  lines: Line[],
  totals: SheetTotals,
  dateLabel: string,
  subRow: number,
  taxRow: number,
  grandRow: number,
): string {
  const rows: string[] = []
  rows.push(rowXml(1, [
    { ref: 'A1', t: 's', s: 1, v: 'QuoteClean estimate — from PlanSwift takeoff. Not re-keyed.' },
    { ref: 'G1', t: 's', s: 5, v: dateLabel },
  ]))
  rows.push(rowXml(2, HEADERS.map((h, i) => ({ ref: `${colLetter(i)}2`, t: 's', s: 2, v: h }))))
  lines.forEach((l, idx) => {
    const r = idx + 3
    rows.push(rowXml(r, [
      { ref: `A${r}`, t: 'n', s: 0, v: idx + 1 },
      { ref: `B${r}`, t: 's', s: 7, v: l.desc },
      { ref: `C${r}`, t: 'n', s: 3, v: l.qty },
      { ref: `D${r}`, t: 's', s: 0, v: l.unit },
      { ref: `E${r}`, t: 'n', s: 4, v: l.price },
      { ref: `F${r}`, t: 'n', s: 4, v: +(l.qty * l.price).toFixed(2) },
      { ref: `G${r}`, t: 's', s: 7, v: l.notes },
    ]))
  })
  rows.push(rowXml(subRow, [
    { ref: `B${subRow}`, t: 's', s: 5, v: 'Subtotal' },
    { ref: `F${subRow}`, t: 'n', s: 6, v: +totals.sub.toFixed(2) },
  ]))
  if (totals.taxOn) {
    rows.push(rowXml(taxRow, [
      { ref: `B${taxRow}`, t: 's', s: 5, v: 'Tax' },
      { ref: `F${taxRow}`, t: 'n', s: 6, v: +totals.tax.toFixed(2) },
    ]))
  }
  rows.push(rowXml(grandRow, [
    { ref: `B${grandRow}`, t: 's', s: 5, v: 'Grand total' },
    { ref: `F${grandRow}`, t: 'n', s: 6, v: +totals.total.toFixed(2) },
    { ref: `G${grandRow}`, t: 's', s: 5, v: 'Confirm Qty vs Unit Price before pasting into the office template' },
  ]))

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>
<col min="1" max="1" width="8" customWidth="1"/>
<col min="2" max="2" width="44" customWidth="1"/>
<col min="3" max="3" width="10" customWidth="1"/>
<col min="4" max="4" width="10" customWidth="1"/>
<col min="5" max="5" width="14" customWidth="1"/>
<col min="6" max="6" width="14" customWidth="1"/>
<col min="7" max="7" width="42" customWidth="1"/>
</cols>
<sheetData>${rows.join('')}</sheetData>
<mergeCells count="1"><mergeCell ref="A1:F1"/></mergeCells>
</worksheet>`
}

function guideSheetXml(dateLabel: string): string {
  const lines = [
    ['Paste guide', dateLabel],
    [''],
    ['QuoteClean is not a PlanSwift plugin. It does not write back into PlanSwift or Togal.'],
    ['Paste the Estimate sheet into the office template. Do not retype line items.'],
    [''],
    ['1. On the Estimate tab, confirm Qty vs Unit Price. A swapped pair is a bad bid.'],
    ['2. Columns are Item, Description, Qty, UOM, Unit Price, Total, Notes.'],
    ['3. Copy those columns onto the matching fields in your office Excel template.'],
    ['4. Source may be a PlanSwift Export by Page dump, an Estimating-tab layout, pad notes, or the office template itself.'],
    ['5. Lock the column map in QuoteClean before export so Qty is never taken from Unit Cost / Cost Each / Total.'],
  ]
  const rowXmls = lines.map((cols, i) =>
    rowXml(i + 1, cols.filter(Boolean).map((v, ci) => ({
      ref: `${colLetter(ci)}${i + 1}`,
      t: 's' as const,
      s: i === 0 ? 1 : 0,
      v,
    }))),
  )
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<cols><col min="1" max="1" width="110" customWidth="1"/><col min="2" max="2" width="16" customWidth="1"/></cols>
<sheetData>${rowXmls.join('')}</sheetData>
</worksheet>`
}

type Cell = { ref: string; t: 's' | 'n'; s: number; v: string | number }

function rowXml(r: number, cells: Cell[]): string {
  const inner = cells.map((c) => {
    if (c.t === 'n') return `<c r="${c.ref}" s="${c.s}"><v>${c.v}</v></c>`
    return `<c r="${c.ref}" s="${c.s}" t="inlineStr"><is><t>${xml(String(c.v))}</t></is></c>`
  }).join('')
  return `<row r="${r}">${inner}</row>`
}

function csvCell(v: string) {
  return `"${v.replace(/"/g, '""')}"`
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

function contentTypes() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
}

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
<sheet name="Estimate" sheetId="1" r:id="rId1"/>
<sheet name="Paste guide" sheetId="2" r:id="rId2"/>
</sheets>
</workbook>`

const WB_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2">
<numFmt numFmtId="164" formatCode="0.###"/>
<numFmt numFmtId="165" formatCode="$#,##0.00"/>
</numFmts>
<fonts count="4">
<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="16"/><color rgb="FF1F4E79"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FF1F4E79"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border>
<left style="thin"><color rgb="FFD0D7DE"/></left>
<right style="thin"><color rgb="FFD0D7DE"/></right>
<top style="thin"><color rgb="FFD0D7DE"/></top>
<bottom style="thin"><color rgb="FFD0D7DE"/></bottom>
<diagonal/>
</border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" applyFont="1"/>
<xf numFmtId="165" fontId="3" fillId="0" borderId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
</cellXfs>
</styleSheet>`
