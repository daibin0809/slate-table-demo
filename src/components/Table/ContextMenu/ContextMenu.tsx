import { FC, useEffect, useRef, useState } from 'react'
import { Editor, Path } from 'slate'
import ReactDOM from 'react-dom'
import deleteCol from '../operate/deleteCol'
import deleteRow from '../operate/deleteRow'
import { insertColLeft, insertColRight } from '../operate/insertCol'
import { insertRowAbove, insertRowBelow } from '../operate/insertRow'
import mergeCells from '../operate/mergeCells'
import splitCells from '../operate/splitCells'
import { getCellBySelectOrFocus, setTableNodeOrigin } from '../../utils/util'
import { TableCellElement } from '../customTypes'
import './ContextMenu.scss'

interface Props {
  editor: Editor
  selectCells: Path[]
  visible: boolean
  position: {
    left: number
    top: number
  }
}

const CURSOR_DISTANCE = 10

export const ContextMenu: FC<Props> = ({
  editor,
  selectCells,
  visible,
  position
}) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [point, setPoint] = useState({
    left: -9999,
    top: -999,
  })

  useEffect(() => {
    if (visible && menuRef.current) {
      const { offsetHeight, offsetWidth } = menuRef.current
      const { innerHeight, innerWidth } = window
      const top =
        offsetHeight + position.top > innerHeight - CURSOR_DISTANCE
          ? position.top - offsetHeight
          : position.top + CURSOR_DISTANCE
      const left =
        offsetWidth + position.left > innerWidth - CURSOR_DISTANCE
          ? position.left - offsetWidth
          : position.left - CURSOR_DISTANCE

      setPoint({ top, left })
    }
  }, [visible, position])

  const updateTableNode = (cellPaths: Path[]) => {
    const cells = getCellBySelectOrFocus(editor, cellPaths)
    setTableNodeOrigin(editor, Path.parent(Path.parent(cells[0])))
  }

  const run = (func: (editor: Editor, selectCells: Path[]) => void) => {
    func(editor, selectCells)
    updateTableNode(selectCells)
  }

  const isMergeCell = () => {
    const newCell = getCellBySelectOrFocus(editor, selectCells)
    for (const cellPath of newCell) {
      const [cellNode] = Editor.node(editor, cellPath)
      if (cellNode) {
        const { rowSpan = 1, colSpan = 1 } = cellNode as TableCellElement
        if (rowSpan > 1 || colSpan > 1) return true
      }
    }
    return false
  }

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      className="yt-e-table-context-menu"
      style={{
        display: visible ? 'flex' : 'none',
        left: `${point.left + 10}px`,
        top: `${point.top - 10}px`,
      }}
      onContextMenu={(e) => {
        e.preventDefault()
      }}
    >
      <div
        onMouseDown={(e) => {
          e.preventDefault()
          run(insertRowAbove)
        }}
      >
        向上插入 1 行
      </div>
      <div
        onMouseDown={(e) => {
          e.preventDefault()
          run(insertRowBelow)
        }}
      >
        向下插入 1 行
      </div>
      <div
        onMouseDown={(e) => {
          e.preventDefault()
          run(insertColLeft)
        }}
      >
        向左插入 1 列
      </div>
      <div
        onMouseDown={(e) => {
          e.preventDefault()
          run(insertColRight)
        }}
      >
        向右插入 1 列
      </div>
      <span className="yt-e-split-line" />
      <div
        onMouseDown={(e) => {
          e.preventDefault()
          run(deleteRow)
        }}
      >
        删除行
      </div>
      <div
        onMouseDown={(e) => {
          e.preventDefault()
          run(deleteCol)
        }}
      >
        删除列
      </div>
      <span className="yt-e-split-line" />
      <div
        className={selectCells.length > 1 ? '' : 'yt-e-disabled'}
        onMouseDown={(e) => {
          e.preventDefault()
          if (selectCells.length < 2) return
          run(mergeCells)
        }}
      >
        合并单元格
      </div>
      <div
        className={isMergeCell() ? '' : 'yt-e-disabled'}
        onMouseDown={(e) => {
          e.preventDefault()
          if (!isMergeCell()) return
          run(splitCells)
        }}
      >
        取消合并
      </div>
    </div>,
    document.body,
  )
}
