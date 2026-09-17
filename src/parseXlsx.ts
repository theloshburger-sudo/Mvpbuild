import { strFromU8, unzipSync } from 'fflate'

/** First worksheet → TSV so the Excel-template parser / textarea can use it. */
export function xlsxToTsv(buf: ArrayBuffer): string {
  const files = unzipSync(new Uint8Array(buf))
  const names = Object.keys(files)
  const stringsXml = findFile(files, names, /xl\/sharedStrings\.xml$/i)
  const strings = stringsXml ? parseSharedStrings(strFromU8(stringsXml)) : []
  const sheetXml = findFile(files, names, /xl\/worksheets\/sheet1\.xml$/i)
    ?? findFile(files, names, /xl\/worksheets\/sheet\d+\.xml$/i)
  if (!sheetXml) {
    throw new Error('No worksheet found in this workbook. Copy the sheet from Excel and paste it, or save as CSV.')
  }
  const rows = parseSheet(strFromU8(sheetXml), strings)
  if (!rows.length) {
    throw new Error('The first sheet is empty. Copy the used range from Excel and paste it here.')
  }
  return rows.map((r) => r.join('\t')).join('\n')
}

function findFile(files: Record<string, Uint8Array>, names: string[], re: RegExp) {
  const key = names.find((n) => re.test(n.replace(/\\/g, '/')))
  return key ? files[key] : undefined
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = []
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/gi
  let m: RegExpExecArray | null
  while ((m = siRe.exec(xml))) {
    out.push(cellText(m[1] ?? ''))
  }
  return out
}

function parseSheet(xml: string, strings: string[]): string[][] {
  const rows: string[][] = []
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/gi
  let rowMatch: RegExpExecArray | null
  while ((rowMatch = rowRe.exec(xml))) {
    const cells: string[] = []
    const cRe = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/gi
    const block = rowMatch[1] ?? ''
    let cMatch: RegExpExecArray | null
    while ((cMatch = cRe.exec(block))) {
      const attrs = cMatch[1] || cMatch[3] || ''
      const inner = cMatch[2] ?? ''
      const ref = attr(attrs, 'r')
      const t = attr(attrs, 't')
      const i = colIndex(ref)
      while (cells.length < i) cells.push('')
      cells[i] = decodeCell(t, inner, strings)
    }
    if (cells.some((c) => c.trim())) rows.push(cells.map((c) => c.trim()))
  }
  return rows
}

function decodeCell(t: string, inner: string, strings: string[]): string {
  if (t === 's') {
    const v = tagText(inner, 'v')
    const n = Number(v)
    return Number.isFinite(n) ? (strings[n] ?? v) : v
  }
  if (t === 'inlineStr' || t === 'str') return cellText(inner)
  const v = tagText(inner, 'v')
  return v || cellText(inner)
}

function cellText(block: string): string {
  const parts: string[] = []
  const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/gi
  let m: RegExpExecArray | null
  while ((m = tRe.exec(block))) parts.push(decodeXml(m[1] ?? ''))
  return parts.join('')
}

function tagText(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return m ? decodeXml(m[1] ?? '') : ''
}

function attr(attrs: string, name: string): string {
  const m = attrs.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'))
  return m?.[1] ?? ''
}

function colIndex(ref: string): number {
  const m = ref.match(/^[A-Z]+/i)
  if (!m) return 0
  let n = 0
  for (const ch of m[0]!.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return Math.max(0, n - 1)
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}
