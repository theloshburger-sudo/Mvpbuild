export type ColRole =
  | 'ignore'
  | 'item'
  | 'desc'
  | 'qty'
  | 'unit'
  | 'price'
  | 'notes'
  | 'sheet'
  | 'total'

export const ROLE_LABEL: Record<ColRole, string> = {
  ignore: 'Ignore',
  item: 'Item #',
  desc: 'Description',
  qty: 'Qty',
  unit: 'UOM',
  price: 'Unit Price',
  notes: 'Notes',
  sheet: 'Sheet / page',
  total: 'Total (verify)',
}

export const UNIQUE_ROLES: ColRole[] = ['desc', 'qty', 'unit', 'price', 'notes', 'sheet', 'total', 'item']

export type Line = {
  qty: number
  unit: string
  desc: string
  price: number
  notes: string
  sourceTotal: number | null
  warnings: string[]
}

export type TableData = {
  headers: string[]
  body: string[][]
  hasHeader: boolean
}
