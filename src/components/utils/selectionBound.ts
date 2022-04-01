import { Editor, Path } from 'slate'
import { ReactEditor } from 'slate-react'
import { TableElement } from '../../components/Table/customTypes'
import { getOriginTable, getRange, getRealPathByPath, rangeType } from './util'

export default function selectionBound(editor: Editor, selectPath: Path[]) {
  // 不能直接根据 selectPath 获取左上 右下单元格计算
  const tablePath = Path.parent(Path.parent(selectPath[0]))
  const [tableNode] = Editor.node(editor, tablePath)
  const originTable = getOriginTable(tableNode as TableElement)

  const originSelectPath: rangeType[] = []
  selectPath.forEach((cellPath) => {
    const relativePath = Path.relative(cellPath, tablePath)
    const originRange = originTable[relativePath[0]][relativePath[1]]
    if (Array.isArray(originRange[0])) {
      originSelectPath.push(
        originRange[0] as rangeType,
        originRange[1] as rangeType,
      )
    } else {
      originSelectPath.push(originRange as rangeType)
    }
  })
  const { xRange, yRange } = getRange(...originSelectPath)

  const ltRelativePath = [xRange[0], yRange[0]]
  const rbRelativePath = [xRange[1], yRange[1]]
  const ltPath = getRealPathByPath(originTable, ltRelativePath)
  const rbPath = getRealPathByPath(originTable, rbRelativePath)

  const [startNode] = Editor.node(editor, [...tablePath, ...ltPath])
  const [endNode] = Editor.node(editor, [...tablePath, ...rbPath])

  const ltDom = ReactEditor.toDOMNode(editor, startNode)
  const rbDom = ReactEditor.toDOMNode(editor, endNode)

  const ltBound = ltDom.getBoundingClientRect()
  const rbBound = rbDom.getBoundingClientRect()
  return {
    x: ltDom.offsetLeft,
    y: ltDom.offsetTop,
    left: ltBound.left,
    top: ltBound.top,
    right: rbBound.right,
    bottom: rbBound.bottom,
  }
}
