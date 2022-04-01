import { Editor, Node, NodeEntry, Path, Transforms } from 'slate'
import {
  getCellBySelectOrFocus,
  getEmptyCellNode,
  getRowNode,
  getNextInsertRowPosition,
  getOriginTable,
} from '../../utils/util'
import { TableCellElement, TableElement } from '../customTypes'

/**
 * 获取需要插入的行数以及插入位置信息
 * @param editor
 * @param tablePath
 * @param cell
 * @returns
 */
function getInsertRowInfo(
  editor: Editor,
  tablePath: Path,
  cell: NodeEntry<Node>,
) {
  const [tableNode] = Editor.node(editor, tablePath)
  const originTable = getOriginTable(tableNode as TableElement)
  const [cellNode, cellPath] = cell
  const { rowSpan = 1 } = cellNode as TableCellElement
  const relativePath = Path.relative(cellPath, tablePath)
  const originPath = originTable[relativePath[0]][relativePath[1]] as number[][]
  const currentOriginRow: number = originPath[0][0]
  const range: number = originPath[1][0] - originPath[0][0]
  const positions: [number, number][] = []
  let insertRow = 0

  for (let i = 1; i <= range; i++) {
    // 表格行
    const rowIndex = relativePath[0] + i
    // 期待源表格行
    const originRowIndex = currentOriginRow + i + insertRow
    if (!originTable[rowIndex]) {
      positions.push([rowSpan - insertRow - i, i + insertRow])
      return positions
    }
    const newOrigin = originTable[rowIndex][0]
    // 真实源表格行
    const currentRowIndex: number = Array.isArray(newOrigin[0])
      ? newOrigin[0][0]
      : newOrigin[0]
    if (currentRowIndex !== originRowIndex) {
      const data: [number, number] = [
        currentRowIndex - originRowIndex,
        i + insertRow,
      ]
      insertRow += currentRowIndex - originRowIndex
      positions.push(data)
    }
  }

  return positions
}

/**
 * 处理单元格的列拆分和单元格跨行时填充
 * @param editor
 * @param cellNode
 * @param tablePath
 * @param sourceOriginCol
 */
function dealCell(
  editor: Editor,
  cellNode: NodeEntry<Node>,
  sourceOriginCol: number,
) {
  let currentRow = Path.parent(cellNode[1])
  const { colSpan = 1, rowSpan = 1 } = cellNode[0] as TableCellElement

  Array.from({ length: rowSpan }).forEach((_, rowIndex) => {
    if (rowIndex === 0 && colSpan > 1) {
      // 处理当前单元格同行且需要拆分
      const nodes = Array.from({ length: colSpan - 1 }).map(() =>
        getEmptyCellNode(),
      )
      Transforms.insertNodes(editor, nodes, {
        at: Path.next(cellNode[1]),
      })
    }
    if (rowIndex !== 0) {
      // 存在跨行数是拆分
      currentRow = Path.next(currentRow)
      const nodes = Array.from({ length: colSpan }).map(() =>
        getEmptyCellNode(),
      )

      // 处理下一行拆分后单元起点
      const path = getNextInsertRowPosition(editor, currentRow, sourceOriginCol)

      Transforms.insertNodes(editor, nodes, {
        at: path,
      })
    }
  })
}

function splitCell(editor: Editor, cellNode: NodeEntry<Node>) {
  const { colSpan = 1, rowSpan = 1 } = cellNode[0] as TableCellElement
  if (colSpan === 1 && rowSpan === 1) return // 单元格不存在合并

  const currentRow = Path.parent(cellNode[1])
  const tablePath = Path.parent(currentRow)

  // 插入行
  if (rowSpan > 1) {
    const insertRowArr = getInsertRowInfo(editor, tablePath, cellNode)

    if (insertRowArr.length > 0) {
      const [rowIndex] = Path.relative(currentRow, tablePath)

      insertRowArr.forEach(([insertRow, position]) => {
        const rowNodes = Array.from({ length: insertRow }).map(() =>
          getRowNode([]),
        )

        Transforms.insertNodes(editor, rowNodes, {
          at: [...tablePath, rowIndex + position],
        })
      })
    }
  }

  // 需要在手动插入行之后，setNodes 之前使用
  const [tableNode] = Editor.node(editor, tablePath)
  const originTable = getOriginTable(tableNode as TableElement)
  const relativePath = Path.relative(cellNode[1], tablePath)
  const sourceOriginCell = originTable[relativePath[0]][relativePath[1]] as number[][]
  const sourceOriginCol: number = sourceOriginCell[0][1]

  // 保留单元格
  Transforms.setNodes(
    editor,
    {
      colSpan: 1,
      rowSpan: 1,
    },
    {
      at: cellNode[1],
    },
  )

  dealCell(editor, cellNode, sourceOriginCol)
}

export default function splitCells(editor: Editor, cellPaths: Path[]) {
  const newCell: Path[] = getCellBySelectOrFocus(editor, cellPaths)

  if (!newCell[0]) return // 倒序拆分，避免拆分后续单元格找不到对应的位置
  ;[...newCell].reverse().forEach((cell) => {
    const node = Editor.node(editor, cell)
    splitCell(editor, node)
  })

  // 焦点聚焦
  Transforms.select(editor, {
    anchor: Editor.end(editor, newCell[0]),
    focus: Editor.end(editor, newCell[0]),
  })
}
