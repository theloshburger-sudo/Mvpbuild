const BOOK: Record<string, number> = {
  drywall: 18.5, gwb: 18.5, mud: 14, compound: 14, stud: 4.25, insulation: 32, batt: 32,
  paint: 38, labor: 55, baseboard: 1.85, door: 145, hardware: 28, dumpster: 475,
  cleanup: 55, fastener: 125,
}

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
  if (/^uom$|^units?$/.test(u)) return 'ea'
  return u
}
