import { Editor, Path, Transforms } from 'slate'
import {
  getCellBySelectOrFocus,
  getNextInsertRowPosition,
  getRange,
  getRangeByOrigin,
  getRealPathByPath,
  getTableByCellPath,
  isContainPath,
  rangeType,
} from '../../utils/util'
import { TableCellElement, TableElement } from '../customTypes'

type IRangePath = [path: Path, rowNum: number, needMove: boolean][]

/**
 * 获取由于删除行影响其他单元格需要处理的数据
 * 后续处理 --- 修改 rowSpan / 移动当前合并的单元格并修改 rowSpan
 * @param xRange
 * @param originTable
 * @returns
 */
function getNeedHandleData(
  originTable: (number | number[])[][][],
  xRange: rangeType,
) {
  const rangePath: [path: Path, rowNum: number, needMove: boolean][] = []

  Array.from({ length: xRange[1] - xRange[0] + 1 }).forEach((_, index) => {
    let i = 0
    let originCell = [xRange[0], 0]
    while (isContainPath(originTable, originCell)) {
      const currentRange = getRangeByOrigin(originTable, originCell)
      if (
        Array.isArray(currentRange[0]) && Array.isArray(currentRange[1]) &&
        (currentRange[0][0] < xRange[0] || currentRange[1][0] > xRange[1])
      ) {
        // 当存在跨行且跨行不在当前删除元素范围内，需要 rowSpan
        const realPath = getRealPathByPath(originTable, originCell)
        if (!rangePath.some(([path]) => Path.equals(path, realPath))) {
          // 过滤重复数据
          const rowNum =
            Math.min(currentRange[1][0], xRange[1]) -
            Math.max(currentRange[0][0], xRange[0]) +
            1
          rangePath.push([realPath, rowNum, currentRange[0][0] >= xRange[0]])
        }
      }
      i++
      originCell = [xRange[0] + index, i]
    }
  })
  return rangePath
}

export default function deleteRow(editor: Editor, cellPaths: Path[]) {
  const newCell: Path[] = getCellBySelectOrFocus(editor, cellPaths)

  if (!newCell[0]) return

  // 获取源表格数据
  const [originTable, tablePath] = getTableByCellPath(editor, newCell[0])

  // 获取当前所有单元格源表格中数据
  const cellRanges: rangeType[] = []
  newCell.forEach((cell) => {
    const relativeCellPath = Path.relative(cell, tablePath)
    const originCellPath = originTable[relativeCellPath[0]][relativeCellPath[1]]
    const cellRange = (
      Array.isArray(originCellPath[0]) ? originCellPath : [originCellPath]
    ) as rangeType[]
    cellRanges.push(...cellRange)
  })

  const { xRange } = getRange(...(cellRanges as rangeType[]))
  const rangePath: IRangePath = getNeedHandleData(originTable, xRange)

  // 获取需要删除的行
  const relativeCellPath = Path.relative(newCell[0], tablePath)
  const deleteRows = [relativeCellPath[0]]
  for (let i = 1; i < xRange[1] - xRange[0] + 1; i++) {
    const curRow = relativeCellPath[0] + i
    if (!originTable[curRow]) break
    const originCell = originTable[curRow][0]
    const originRow = Array.isArray(originCell[0])
      ? originCell[0][0]
      : originCell[0]
    if (originRow > xRange[1]) break
    deleteRows.unshift(curRow)
  }

  // 先对需要处理的单元格处理
  // 倒序处理，防止 moveNodes 后，path 改变
  ;[...rangePath].reverse().forEach(([path, rowNum, needMove]) => {
    const curPath = [...tablePath, ...path]
    const [curNode] = Editor.node(editor, curPath)
    const { rowSpan = 1 } = curNode as TableCellElement

    Transforms.setNodes(
      editor,
      {
        rowSpan: rowSpan - rowNum,
      },
      {
        at: curPath,
      },
    )

    if (needMove) {
      const curCellOriginPath = originTable[path[0]][path[1]] as number[][]
      const sourceOriginCol: number = curCellOriginPath[0][1]
      let nextRowPath = Path.next(Path.parent(curPath))

      // 防止下一行也被删除
      while (true) {
        const rowIndex = Path.relative(nextRowPath, tablePath)[0]
        if (!deleteRows.includes(rowIndex)) break
        nextRowPath = Path.next(nextRowPath)
      }

      const nextRowCell = getNextInsertRowPosition(
        editor,
        nextRowPath,
        sourceOriginCol,
      )

      Transforms.moveNodes(editor, {
        at: curPath,
        to: nextRowCell,
      })
    }
  })

  // 删除行
  deleteRows.forEach((row) => {
    Transforms.removeNodes(editor, {
      at: [...tablePath, row],
    })
  })

  // 是否为空表格
  const [tableNode] = Editor.node(editor, tablePath)
  if (Editor.isEmpty(editor, tableNode as TableElement)) {
    Transforms.removeNodes(editor, {
      at: tablePath,
    })
  }
}
