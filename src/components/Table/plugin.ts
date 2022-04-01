import {
  BaseOperation,
  Editor,
  Element,
  Path,
  Point,
  Range,
  SetNodeOperation,
  Transforms,
} from 'slate'
import { isCanEditInTable } from '../utils/util'

const HEADER_LIST = new Set(['h1', 'h2', 'h3', 'h4'])
/**
 * 处理表格选区存在时，操作功能
 * @param editor
 * @param operation
 * @param apply
 */
const dealSelectionInTable = (
  editor: Editor,
  operation: SetNodeOperation,
  apply: (operation: BaseOperation) => void,
) => {
  const { selection: tableSelection } = editor.tableState

  tableSelection.forEach((cellPath) => {
    const [...nodes] = Editor.nodes(editor, {
      at: cellPath,
      mode: 'lowest',
      match: (n) =>
        !Editor.isEditor(n) && Element.isElement(n) && n.type !== 'tableCell',
    })
    nodes.forEach((node) => {
      apply({
        ...operation,
        path: node[1],
      })
    })
  })
}

/**
 * 是否在表格中
 * @returns
 */
const isInTable = (editor: Editor) => {
  const [tableNode] = Editor.nodes(editor, {
    match: (n) =>
      !Editor.isEditor(n) && Element.isElement(n) && n.type === 'table',
    mode: 'highest',
  })
  return !!tableNode
}

const getCellChildren = (fragment: Element[], pasteData: Element[]) => {
  let data: Element[] = [...pasteData]
  for (const el of fragment) {
    if (el.type === 'tableCell') {
      data = [...data, ...(el.children as unknown as Element[])]
      break
    } else {
      data = [
        ...data,
        ...getCellChildren(el.children as unknown as Element[], data),
      ]
    }
  }
  return data
}

const isDealBlock = (operation: SetNodeOperation) => {
  const property = operation.newProperties
  if (Reflect.has(property, 'textAlign')) return true
  if (
    Reflect.has(property, 'type') &&
    HEADER_LIST.has((property as Partial<Element>).type as string)
  )
    return true
  return false
}

/**
 * 判断指定 cellPaths 是否是整个Table Path
 * @param editor
 * @param cells
 * @returns
 */
const getIsAllCellsByTable = (editor: Editor, cells: Path[]) => {
  const [...cellNodes] = Editor.nodes(editor, {
    at: Path.parent(Path.parent(cells[0])),
    match: (n) =>
      !Editor.isEditor(n) && Element.isElement(n) && n.type === 'tableCell',
  })
  return cellNodes.every(([_, cell]) =>
    cells.some((value) => Path.equals(value, cell)),
  )
}

function getEmptyParagraph(): Element {
  return { type: 'paragraph', children: [{ text: '' }] }
}

const resetCellContent = (editor: Editor, cellPath: Path) => {
  Transforms.removeNodes(editor, {
    at: {
      anchor: Editor.start(editor, cellPath),
      focus: Editor.end(editor, cellPath),
    },
  })
  const paragraph = getEmptyParagraph()
  Transforms.insertNodes(editor, paragraph, {
    at: [...cellPath, 0],
  })
}

export const withTable = <T extends Editor>(editor: T) => {
  const e = editor
  const {
    addMark,
    apply,
    removeMark,
    deleteBackward,
    deleteForward,
    insertFragment,
    deleteFragment,
    normalizeNode,
  } = editor

  e.apply = (operation) => {
    const { showSelection } = e.tableState

    switch (operation.type) {
      case 'set_node':
        if (showSelection && isDealBlock(operation)) {
          // 处理选区存在时，对齐方式操作
          dealSelectionInTable(editor, operation, apply)
        } else {
          apply(operation)
        }
        break
      default:
        apply(operation)
    }
  }

  e.addMark = (key, value) => {
    const { selection: tableSelection, showSelection } = e.tableState

    if (showSelection) {
      tableSelection.forEach((cell) => {
        const cellPostion = Editor.range(e, cell)
        Transforms.select(e, cellPostion)
        addMark(key, value)
      })
    } else {
      addMark(key, value)
    }
  }

  e.removeMark = (key) => {
    const { selection: tableSelection, showSelection } = e.tableState

    if (showSelection) {
      tableSelection.forEach((cell) => {
        const cellPostion = Editor.range(e, cell)
        Transforms.select(e, cellPostion)
        removeMark(key)
      })
    } else {
      removeMark(key)
    }
  }

  e.insertFragment = (fragment) => {
    const { selection } = e
    if (!selection || !isInTable(e)) {
      insertFragment(fragment)
      return
    }
    // 鼠标聚焦在表格中
    const [cellNode] = Editor.nodes(editor, {
      at: selection,
      mode: 'lowest',
      match: (n) =>
        !Editor.isEditor(n) && Element.isElement(n) && n.type === 'tableCell',
    })
    const selectNode = Editor.node(editor, selection)
    const relativePath = Path.relative(selectNode[1], cellNode[1])
    const nodePath = [...cellNode[1], relativePath[0]]
    const node = Editor.node(editor, nodePath)

    if (
      Element.matches(fragment[0] as Element, { type: 'table' }) &&
      Editor.isEmpty(editor, node[0] as Element)
    ) {
      // 处理在单元格，新行粘贴单元格内容是整个表格问题
      const insertEl = getCellChildren(fragment as Element[], [])
      insertFragment(insertEl)
      return
    }
    insertFragment(fragment)
  }

  e.deleteFragment = (...args) => {
    // 编辑器选择内容 backspace delete 时
    const { selection: tableSelection, showSelection } = e.tableState

    // 表格中选择，但是结束不在表格内
    if (!showSelection && tableSelection.length > 0) return

    if (showSelection) {
      const isAllCells = getIsAllCellsByTable(editor, tableSelection)
      if (isAllCells) {
        // 选区为整个表格时，删除表格
        editor.emit('resetTableSelection')
        Transforms.removeNodes(editor, {
          at: Path.parent(Path.parent(tableSelection[0])),
        })
        return
      }
      // 选区不是整个表格时，清空选区单元格
      tableSelection.forEach((cellPath) => {
        resetCellContent(editor, cellPath)
      })
      return
    }
    if (!isCanEditInTable(editor)) return

    deleteFragment(...args)
  }

  e.deleteBackward = (...args) => {
    // 防止 backspace 完全删除单元格
    const { selection } = e
    if (selection && Range.isCollapsed(selection)) {
      const [cell] = Editor.nodes(editor, {
        match: (n) =>
          !Editor.isEditor(n) && Element.isElement(n) && n.type === 'tableCell',
      })

      if (cell) {
        const [, cellPath] = cell
        const start = Editor.start(e, cellPath)
        if (Point.equals(selection.anchor, start)) return
      }
    }

    deleteBackward(...args)
  }
  e.deleteForward = (...args) => {
    // 防止 delete 完全删除单元格
    const { selection } = e
    if (selection && Range.isCollapsed(selection)) {
      const [cell] = Editor.nodes(editor, {
        match: (n) =>
          !Editor.isEditor(n) && Element.isElement(n) && n.type === 'tableCell',
      })

      if (cell) {
        const [, cellPath] = cell
        const start = Editor.end(e, cellPath)
        if (Point.equals(selection.anchor, start)) return
      }
    }

    deleteForward(...args)
  }

  e.normalizeNode = (entry) => {
    const [node, path] = entry
    if (!Element.isElement(node) || node.type !== 'table') {
      normalizeNode(entry)
      return
    }
    const rootNode = e.children || []
    const rootLen = rootNode.length
    const isFirst = rootLen === 0
    const isLast = node === rootNode[rootLen - 1]
    const nextPath = Path.next(path)

    // 顺序不能变化---如果前后都需要插入，顺序就至关重要
    if (isLast) {
      // table 是最后一个节点是后方插入节点
      Transforms.insertNodes(e, getEmptyParagraph(), { at: nextPath })
    }
    if (isFirst) {
      // table 是最后一个节点是前方插入节点
      Transforms.insertNodes(e, getEmptyParagraph(), { at: path })
    }

    const nextNode = rootNode[nextPath[0]]
    if (Element.isElement(nextNode) && nextNode.type === 'table') {
      Transforms.insertNodes(e, getEmptyParagraph(), { at: nextPath })
    }
  }

  return e
}
