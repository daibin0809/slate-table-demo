import { Editor, Path, Transforms } from 'slate'
import {
  getCellBySelectOrFocus,
  getRange,
  getRealPathByPath,
  getTableByCellPath,
  rangeType,
} from '../../utils/util'
import { TableCellElement, TableElement, TableRowElement } from '../customTypes'

export default function deleteCol(editor: Editor, cellPaths: Path[]) {
  /**
   * 根据原始表格的数据计算，保证数据获取准确
   * 1. 获取 col 范围
   * 2. 封装获取下一行中对应位置的单元格
   * 3. 如存在行合并则判断是全部删除还是修改 colSpan
   */
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

  const { yRange } = getRange(...(cellRanges as rangeType[]))
  const rowLen = originTable.length
  // 倒序处理数据
  for (let rowIndex = rowLen - 1; rowIndex >= 0; rowIndex--) {
    const originCell = originTable[rowIndex][0]
    const originRowIndex = Array.isArray(originCell[0])
      ? originCell[0][0]
      : originCell[0]
    for (let colIndex = yRange[1]; colIndex >= yRange[0]; colIndex--) {
      const originCellPath = [originRowIndex, colIndex]
      const realCellPath = getRealPathByPath(originTable, originCellPath)
      if (realCellPath[0] === rowIndex) {
        // 单元格同行时才有后续处理
        const curCellPath = [...tablePath, ...realCellPath]
        const [cellNode] = Editor.node(editor, curCellPath)
        const { colSpan = 1 } = cellNode as TableCellElement
        if (colSpan > 1) {
          // 修改 colSpan
          Transforms.setNodes(
            editor,
            {
              colSpan: colSpan - 1,
            },
            {
              at: curCellPath,
            },
          )
        } else {
          // 移除单元格
          Transforms.removeNodes(editor, {
            at: curCellPath,
          })
        }
      }
    }
    // 判断当前行是否为空
    const rowPath = [...tablePath, rowIndex]
    const [rowNode] = Editor.node(editor, rowPath)
    if (Editor.isEmpty(editor, rowNode as TableRowElement)) {
      Transforms.removeNodes(editor, {
        at: rowPath,
      })
    }
    // 是否为空表格
    const [tableNode] = Editor.node(editor, tablePath)
    if (Editor.isEmpty(editor, tableNode as TableElement)) {
      Transforms.removeNodes(editor, {
        at: tablePath,
      })
    }
  }
}
