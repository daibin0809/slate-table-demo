import { Editor, Element, Path, Range, Transforms } from 'slate'
import { ReactEditor } from 'slate-react'
import {
  TableCellElement,
  TableElement,
  TableRowElement,
} from '../Table/customTypes'

export type rangeType = [xStart: number, xEnd: number]

export interface tableRange {
  xRange: rangeType
  yRange: rangeType
}
/**
 * 获取rangs的范围数据
 * @param args
 * @returns
 */
export function getRange(...args: rangeType[]): tableRange {
  const xArr: number[] = []
  const yArr: number[] = []
  args.forEach((item) => {
    xArr.push(item[0])
    yArr.push(item[1])
  })
  return {
    xRange: [Math.min(...xArr), Math.max(...xArr)],
    yRange: [Math.min(...yArr), Math.max(...yArr)],
  }
}

/**
 * 单个源表格 path 获取真实 path(对于slate的相对path)
 * @param originTable
 * @param path
 * @returns
 */
export function getRealPathByPath(
  originTable: (number | number[])[][][],
  path: Path,
) {
  const [x, y] = path

  for (const [rowKey, row] of originTable.entries()) {
    for (const [cellKey, cell] of row.entries()) {
      if (Array.isArray(cell[0]) && Array.isArray(cell[1])) {
        // 是否在范围内
        const xRange = [cell[0][0], cell[1][0]]
        const yRange = [cell[0][1], cell[1][1]]
        if (
          x >= xRange[0] &&
          x <= xRange[1] &&
          y >= yRange[0] &&
          y <= yRange[1]
        ) {
          return [rowKey, cellKey]
        }
      } else if (cell[0] === x && cell[1] === y) {
        return [rowKey, cellKey]
      }
    }
  }

  return [-1, -1]
}

/**
 * 根据源单元格path获取源表格中位置/范围
 * @param originTable
 * @param origin
 * @returns
 */
export function getRangeByOrigin(
  originTable: (number | number[])[][][],
  origin: number[],
) {
  const [x, y] = origin
  for (const row of originTable) {
    for (const cell of row) {
      if (Array.isArray(cell[0]) && Array.isArray(cell[1])) {
        // 是否在范围内
        const xRange = [cell[0][0], cell[1][0]]
        const yRange = [cell[0][1], cell[1][1]]
        if (
          x >= xRange[0] &&
          x <= xRange[1] &&
          y >= yRange[0] &&
          y <= yRange[1]
        ) {
          return cell
        }
      } else if (cell[0] === x && cell[1] === y) {
        return origin
      }
    }
  }
  return []
}

/**
 * 源表格单元格是否在源表格中
 * @param originTable
 * @param target
 * @returns
 */
export function isContainPath(
  originTable: (number | number[])[][][],
  target: number[],
) {
  const [x, y] = target
  for (const row of originTable) {
    for (const cell of row) {
      if (Array.isArray(cell[0]) && Array.isArray(cell[1])) {
        // 存在范围数据，单单元格
        const xRange = [cell[0][0], cell[1][0]]
        const yRange = [cell[0][1], cell[1][1]]
        if (
          x >= xRange[0] &&
          x <= xRange[1] &&
          y >= yRange[0] &&
          y <= yRange[1]
        )
          return true
      } else if (cell[0] === x && cell[1] === y) {
        return true
      }
    }
  }
  return false
}

/**
 * 获取行开始原始表格中位置
 * @param originTable
 * @param rowIndex
 * @param colNum
 * @returns
 */
function getRowOriginPosition(
  originTable: (number | number[])[][][],
  rowIndex: number,
  colNum: number,
) {
  let index = 0

  while (true) {
    let colIndex = 0
    while (colIndex < colNum) {
      const originCell = [rowIndex + index, colIndex]
      if (!isContainPath(originTable, originCell)) return originCell[0]
      colIndex++
    }
    index++
  }
}

/**
 * 根据真实表格获取相应位置源表格数据/范围
 * @param table
 * @returns
 */
export function getOriginTable(table: TableElement) {
  const originTable: (number | number[])[][][] = []
  const colNum = table.children[0].children.reduce(
    (value: number, cell: TableCellElement) => {
      const { colSpan = 1 } = cell
      return colSpan + value
    },
    0,
  )
  let rowIndex = 0 // 行序号

  table.children.forEach((row: TableRowElement) => {
    const originRow: (number | number[])[][] = [] // 原始行数据
    rowIndex = getRowOriginPosition(originTable, rowIndex, colNum)
    let colOriginIndex = 0
    row.children.forEach((cell: TableCellElement) => {
      const { rowSpan = 1, colSpan = 1 } = cell
      while (true) {
        const target = [rowIndex, colOriginIndex]
        if (!isContainPath(originTable, target)) break
        colOriginIndex++
      }

      if (rowSpan === 1 && colSpan === 1) {
        originRow.push([rowIndex, colOriginIndex])
      } else {
        originRow.push([
          [rowIndex, colOriginIndex],
          [rowIndex + rowSpan - 1, colOriginIndex + colSpan - 1],
        ])
      }
      colOriginIndex += colSpan
    })
    originTable.push(originRow)
  })
  return originTable
}

/**
 * 根据 dom 获取相应的 tableCell node
 * @param editor
 * @param target
 * @returns
 */
export function getTableCellNode(editor: Editor, target: HTMLElement) {
  const data = ReactEditor.toSlateNode(editor, target)
  const path = ReactEditor.findPath(editor, data)
  const [node] = Editor.nodes(editor, {
    at: path,
    match: (n) =>
      !Editor.isEditor(n) && Element.isElement(n) && n.type === 'tableCell',
  })
  return node
}

/**
 * 获取指定单元格的 span 范围
 * 转换成源表格计算
 * @param editor
 * @param cellPaths
 * @returns
 */
export function getCellsSpan(
  editor: Editor,
  table: TableElement,
  cellPaths: Path[],
) {
  const originTable = getOriginTable(table)
  const tablePath = ReactEditor.findPath(editor, table)
  const ranges: rangeType[] = []

  cellPaths.forEach((cellPath) => {
    const cellRelative = Path.relative(cellPath, tablePath)
    const originRange = originTable[cellRelative[0]][cellRelative[1]]

    if (Array.isArray(originRange[0]) && Array.isArray(originRange[1])) {
      ranges.push(originRange[0] as rangeType, originRange[1] as rangeType)
    } else {
      ranges.push(originRange as rangeType)
    }
  })

  const { xRange, yRange } = getRange(...ranges)

  return {
    rowSpan: xRange[1] - xRange[0] + 1,
    colSpan: yRange[1] - yRange[0] + 1,
  }
}

/**
 * 判断 cellNode 是否为空cell
 * @param cellNode
 */
export function isEmptyCell(editor: Editor, cellNode: TableCellElement) {
  if (cellNode.children.length > 1) return false
  const content = cellNode.children[0]
  if (content.type !== 'paragraph') return false
  return Editor.isEmpty(editor, content)
}

/**
 * 生产空 cell node
 */
export function getEmptyCellNode(): TableCellElement {
  return {
    type: 'tableCell',
    children: [
      {
        type: 'paragraph',
        children: [{ text: '' }],
      },
    ],
  }
}

/**
 * 生产空 row node
 */
export function getRowNode(children: TableCellElement[]): TableRowElement {
  return {
    type: 'tableRow',
    children,
  }
}

export function getNextRowSpan(editor: Editor, rowPath: Path) {
  const tablePath = Path.parent(rowPath)
  const [tableNode] = Editor.node(editor, tablePath)
  const [rowNode] = Editor.node(editor, rowPath)
  const originTable = getOriginTable(tableNode as TableElement)
  const originRow = Path.relative(rowPath, tablePath)

  const originRowRange = originTable[originRow[0]][0]
  const originRowIndex = Array.isArray(originRowRange[0])
    ? originRowRange[0][0]
    : originRowRange[0]

  if (originTable[originRow[0] + 1]) {
    const originNextRowRange = originTable[originRow[0] + 1][0]
    const originNextRowIndex = Array.isArray(originNextRowRange[0])
      ? originNextRowRange[0][0]
      : originNextRowRange[0]

    return originNextRowIndex - originRowIndex
  }
  return (rowNode as TableRowElement).children[0].rowSpan || 1
}

/**
 * 获取当前位置在下一行插入的位置
 *
 * @param editor
 * @param currentRow
 * @param sourceOriginCol
 * @returns
 */
export function getNextInsertRowPosition(
  editor: Editor,
  nextRow: Path,
  sourceOriginCol: number,
) {
  const [rowNode, rowPath] = Editor.node(editor, nextRow)
  const tablePath = Path.parent(rowPath)

  if (
    Editor.isEmpty(editor, rowNode as TableRowElement) ||
    sourceOriginCol === 0
  ) {
    // 手动插入的行，直接插入第一个位置 || 在行首的拆分
    return [...nextRow, 0]
  }
  // 需要通过源表格获取插入的位置 cellNode[1]
  let i = 1
  const [tableNode] = Editor.node(editor, tablePath)
  const originTable = getOriginTable(tableNode as TableElement)
  const relativeRowPath = Path.relative(nextRow, tablePath)
  const originCell = originTable[relativeRowPath[0]][0]
  const originRow = Array.isArray(originCell[0])
    ? originCell[0][0]
    : originCell[0]

  while (true) {
    const sourceCellOriginPath = [originRow, sourceOriginCol - i]
    const realPath = getRealPathByPath(originTable, sourceCellOriginPath)

    if (realPath[0] === relativeRowPath[0]) {
      // 排除不在当前行情况，避免单元格path超出表格
      return [...nextRow, realPath[1] + 1]
    }
    if (sourceOriginCol === i) {
      // 最后未找到
      return [...nextRow, 0]
    }
    i++
  }
}

/**
 * 获取选中或者聚焦单元格
 * @param editor
 * @param cellPaths
 * @returns
 */
export function getCellBySelectOrFocus(editor: Editor, cellPaths: Path[]) {
  const newCell: Path[] = []
  if (cellPaths.length > 1) {
    // 拆分选区单元格
    newCell.push(...cellPaths)
  } else if (editor.selection) {
    const [node] = Editor.nodes(editor, {
      at: editor.selection,
      match: (n) =>
        !Editor.isEditor(n) && Element.isElement(n) && n.type === 'tableCell',
    })
    if (node) {
      newCell.push(node[1])
    }
  }
  return newCell
}

/**
 * 通过 cellPath 获取Table的 源表格数据 tablePath
 * @param editor
 * @param cellPath
 * @returns [originTable, tablePath, TableElement]
 */
export function getTableByCellPath(
  editor: Editor,
  cellPath: Path,
): [(number | number[])[][][], Path, TableElement] {
  const rowPath = Path.parent(cellPath)
  const tablePath = Path.parent(rowPath)
  const [tableNode] = Editor.node(editor, tablePath)
  const originTable = getOriginTable(tableNode as TableElement)

  return [originTable, tablePath, tableNode as TableElement]
}

/**
 * table node 设置 originTable 数据，便于转换为 word
 * @param editor
 * @param element
 */
export function setTableNodeOrigin(editor: Editor, tablePath: Path) {
  const [tableNode] = Editor.node(editor, tablePath)
  const originTable = getOriginTable(tableNode as TableElement)
  Transforms.setNodes(
    editor,
    {
      originTable,
    },
    {
      at: tablePath,
    },
  )
}

/**
 * 判断当前 selection 是否可以编辑
 * @param editor
 * @returns
 */
export function isCanEditInTable(editor: Editor) {
  // 未聚焦 或者选中 collapsed
  if (!editor.selection || Range.isCollapsed(editor.selection)) return true
  const [...match] = Editor.nodes(editor, {
    match: (n) =>
      !Editor.isEditor(n) && Element.isElement(n) && n.type === 'tableCell',
  })

  const [focusNode] = Editor.nodes(editor, {
    at: editor.selection.focus,
    match: (n) =>
      !Editor.isEditor(n) && Element.isElement(n) && n.type !== 'table',
  })
  const [anchorNode] = Editor.nodes(editor, {
    at: editor.selection.anchor,
    match: (n) =>
      !Editor.isEditor(n) && Element.isElement(n) && n.type !== 'table',
  })

  const isRowByFocus = Element.matches(focusNode[0] as TableRowElement, {
    type: 'tableRow',
  })
  const isRowByAnchor = Element.matches(anchorNode[0] as TableRowElement, {
    type: 'tableRow',
  })

  if (+isRowByFocus + +isRowByAnchor > 0 && match.length > 1) {
    // 选区首尾至少有一个在表格中 && 选中多个单元格
    return false
  }

  if (+isRowByFocus + +isRowByAnchor === 0 && match.length > 0) {
    // 选区首尾不在表格中 && 存在选中表格（注：说明选中的是完整表格，不影响）
    return true
  }

  if (match.length > 0) {
    // 选区存在表格，比较选区首尾
    return Path.equals(anchorNode[1], focusNode[1])
  }
  return true
}
