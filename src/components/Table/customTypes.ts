import { Element } from 'slate'

export type TableCellElement = {
  type: 'tableCell'
  colSpan?: number
  rowSpan?: number
  children: Element[]
}
export type TableRowElement = {
  type: 'tableRow'
  children: TableCellElement[]
}
export type TableElement = {
  type: 'table'
  originTable?: (number | number[])[][][]
  children: TableRowElement[]
}
