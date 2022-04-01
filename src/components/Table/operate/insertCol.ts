import { Editor, Path, Transforms } from 'slate'
import {
  getCellBySelectOrFocus,
  getEmptyCellNode,
  getNextInsertRowPosition,
  getNextRowSpan,
  getRangeByOrigin,
  getRealPathByPath,
  getRowNode,
  getTableByCellPath,
} from '../../utils/util'
import { TableCellElement, TableElement } from '../customTypes'

type Direction = 'left' | 'right'

/**
 * 获取原始数据列数
 * 注：表格第一行肯定是所有列数据都有的
 * @param tableNode
 * @returns
 */
function getColNumber(tableNode: TableElement) {
  const rowNode = tableNode.children[0]
  let colNum = 0
  rowNode.children.forEach((cellNode) => {
    const { colSpan = 1 } = cellNode
    colNum += colSpan
  })
  return colNum
}

/**
 * 在列首尾插入一列
 * @param editor
 * @param tableNode
 * @param tablePath
 * @param rowNum
 * @param position
 */
function insertColByCell(
  editor: Editor,
  tablePath: Path,
  index: number,
  cellIndex: number,
) {
  // 在 insertNodes 前获取跨行数，避免获取不准确
  const rowSpan = getNextRowSpan(editor, [...tablePath, index])

  Transforms.insertNodes(editor, getEmptyCellNode(), {
    at: [...tablePath, index, cellIndex],
  })

  if (rowSpan > 1) {
    Array.from({ length: rowSpan - 1 }).forEach((_, i) => {
      Transforms.insertNodes(editor, getRowNode([getEmptyCellNode()]), {
        at: [...tablePath, index + i + 1],
      })
    })
  }
  return [...tablePath, index, cellIndex]
}

function insertCol(editor: Editor, cellPaths: Path[], direction: Direction) {
  const newCell: Path[] = getCellBySelectOrFocus(editor, cellPaths)

  if (!newCell[0]) return
  // 获取源表格数据
  const [originTable, tablePath, tableNode] = getTableByCellPath(
    editor,
    newCell[0],
  )

  const colNum = getColNumber(tableNode)
  const targetIndex = direction === 'left' ? 0 : newCell.length - 1
  const targetCell = Path.relative(newCell[targetIndex], tablePath)
  const targetOriginCell = originTable[targetCell[0]][targetCell[1]]
  const addConstant = direction === 'left' ? -1 : 1
  const insertOriginColIndex =
    (Array.isArray(targetOriginCell[0]) && Array.isArray(targetOriginCell[1])
      ? direction === 'left'
        ? targetOriginCell[0][1]
        : targetOriginCell[1][1]
      : (targetOriginCell[1] as number)) + addConstant

  const updateCellPaths: Path[] = []
  const len = tableNode.children.length
  let focusPath: Path = []

  // 循环表格每一行处理（真实表格）
  for (let index = len - 1; index >= 0; index--) {
    if (direction === 'left' && insertOriginColIndex === -1) {
      // 在首列左侧插入列
      focusPath = insertColByCell(editor, tablePath, index, 0)
    } else if (direction === 'right' && insertOriginColIndex === colNum) {
      // 在尾列右侧插入列
      focusPath = insertColByCell(
        editor,
        tablePath,
        index,
        originTable[index].length,
      )
    } else {
      const originCell = originTable[index][0]
      const originRowIndex = Array.isArray(originCell[0])
        ? originCell[0][0]
        : originCell[0]
      const curCell = getRealPathByPath(originTable, [
        originRowIndex,
        insertOriginColIndex,
      ])
      const curOriginCell = getRangeByOrigin(originTable, [
        originRowIndex,
        insertOriginColIndex,
      ]) as number[][]
      const edgeColIndex =
        direction === 'left' ? curOriginCell[1][1] : curOriginCell[0][1]

      if (
        !Array.isArray(curOriginCell[0]) ||
        edgeColIndex === insertOriginColIndex
      ) {
        const insertPath = getNextInsertRowPosition(
          editor,
          [...tablePath, index],
          insertOriginColIndex,
        )
        const colIndex = insertPath[insertPath.length - 1]
        focusPath = insertColByCell(
          editor,
          tablePath,
          index,
          direction === 'left' ? colIndex + 1 : colIndex,
        )
      } else if (
        !updateCellPaths.some((cellPath) => Path.equals(curCell, cellPath))
      ) {
        // 需要修改的合并单元格
        const [cellNode] = Editor.node(editor, [...tablePath, ...curCell])
        const { colSpan = 1 } = cellNode as TableCellElement
        Transforms.setNodes(
          editor,
          {
            colSpan: colSpan + 1,
          },
          {
            at: [...tablePath, ...curCell],
          },
        )
        updateCellPaths.push(curCell)
      }
    }
  }
  Transforms.select(editor, {
    anchor: Editor.end(editor, focusPath),
    focus: Editor.end(editor, focusPath),
  })
}

const insertColLeft = (editor: Editor, cellPaths: Path[]) => {
  insertCol(editor, cellPaths, 'left')
}
const insertColRight = (editor: Editor, cellPaths: Path[]) => {
  insertCol(editor, cellPaths, 'right')
}

export { insertColLeft, insertColRight }
