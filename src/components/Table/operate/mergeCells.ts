import { Descendant, Editor, Element, Path, Transforms } from 'slate'
import { TableCellElement, TableRowElement } from '../customTypes'
import { getCellsSpan, getTableByCellPath, isEmptyCell } from '../../utils/util'

/**
 * 合并单元格数据
 * @param editor
 * @param cellPaths
 * @returns
 */
function mergeChildren(editor: Editor, cellPaths: Path[]) {
  const newChildren: Element[] = []
  cellPaths.forEach((cellPath) => {
    const [cellNode] = Editor.node(editor, cellPath)
    const isEmpty = isEmptyCell(editor, cellNode as TableCellElement)
    if (!isEmpty) newChildren.push(...(cellNode as TableCellElement).children)
  })

  return newChildren.length > 0
    ? newChildren
    : [
        {
          type: 'paragraph',
          children: [{ text: '' }],
        },
      ]
}

/**
 * 删除指定单元格同时删除除第一个单元格所在行的其余空行
 * @param editor
 * @param cellPaths
 */
function removeCellByPath(
  editor: Editor,
  cellPaths: Path[],
  tablePath: Path,
) {
  Transforms.removeNodes(editor, {
    // 第一个单元格不删除，避免出现行删除无法插入
    at: tablePath,
    match: (_, path) =>
      !Path.equals(cellPaths[0], path) &&
      cellPaths.some((cellPath) => Path.equals(cellPath, path)),
  })
  // 删除空行element
  Transforms.removeNodes(editor, {
    at: tablePath,
    match: (node) =>
      Element.isElement(node) &&
      node.type === 'tableRow' &&
      !Element.matches((node as TableRowElement).children[0], {
        type: 'tableCell',
      }),
  })
  // 删除第一个选中单元格/不考虑空行
  Transforms.removeNodes(editor, {
    match: (_, path) => Path.equals(cellPaths[0], path),
  })
}

export default function mergeCells(editor: Editor, cellPaths: Path[]) {
  if (cellPaths.length < 2) return
  const [, tablePath, table] = getTableByCellPath(editor, cellPaths[0])
  const children = mergeChildren(editor, cellPaths) as Element[]
  const spans = getCellsSpan(editor, table, cellPaths)

  removeCellByPath(editor, cellPaths, tablePath)
  Transforms.insertNodes(
    editor,
    {
      type: 'tableCell',
      colSpan: spans.colSpan,
      rowSpan: spans.rowSpan,
      children,
    },
    {
      at: cellPaths[0],
    },
  )
  // 焦点聚焦
  Transforms.select(editor, {
    anchor: Editor.end(editor, cellPaths[0]),
    focus: Editor.end(editor, cellPaths[0]),
  })
}
