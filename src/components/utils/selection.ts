import { Editor, Path } from 'slate'
import { ReactEditor } from 'slate-react'
import { TableElement } from '../Table/customTypes'
import {
  getOriginTable,
  getRange,
  getRangeByOrigin,
  getRealPathByPath,
  rangeType,
  tableRange,
} from './util'

/**
 * 根据真实单元格位置获取源表格中数据/范围
 * @param originTable
 * @param real
 * @returns
 */
function getOriginPath(originTable: (number | number[])[][][], real: number[]) {
  return originTable[real[0]][real[1]]
}

/**
 * 判断一个range(ancestor)是否包含另外一个range(range)
 * @param range
 * @param ancestor
 * @returns
 */
function isContainRange(range: tableRange, ancestor: tableRange) {
  if (
    range.xRange[0] >= ancestor.xRange[0] &&
    range.xRange[1] <= ancestor.xRange[1] &&
    range.yRange[0] >= ancestor.yRange[0] &&
    range.yRange[1] <= ancestor.yRange[1]
  )
    return true
  return false
}

/**
 * 获取指定范围返回的range(解决合并扩大range)
 * @param originTable
 * @param xRange
 * @param yRange
 * @returns
 */
function getOriginRange(
  originTable: (number | number[])[][][],
  xRange: rangeType,
  yRange: rangeType,
):{xRange:number[], yRange: number[]} {
  for (let x = xRange[0]; x <= xRange[1]; x++) {
    for (let y = yRange[0]; y <= yRange[1]; y++) {
      const path = [x, y]
      const rangePath = getRangeByOrigin(originTable, path)
      if (rangePath !== path) {
        // 返回范围数据
        const range = getRange(
          [xRange[0], yRange[0]],
          [xRange[1], yRange[1]],
          ...(rangePath as rangeType[]),
        )
        const isContain = isContainRange(range, { xRange, yRange })
        if (!isContain) {
          // 得到更大的范围
          return getOriginRange(originTable, range.xRange, range.yRange)
        }
      }
    }
  }
  return {
    xRange,
    yRange,
  }
}

/**
 * 得到选中内容中源表格的范围
 * @param originTable
 * @param startPath
 * @param endPath
 * @returns
 */
function getAllOriginRange(
  originTable: (number | number[])[][][],
  startPath: Path,
  endPath: Path,
) {
  // 单元格未合并数据
  const originStart = getOriginPath(originTable, startPath)
  const originEnd = getOriginPath(originTable, endPath)

  const newRange: number[][] = []
  if (Array.isArray(originStart[0]) && Array.isArray(originStart[1])) {
    newRange.push(originStart[0], originStart[1])
  } else {
    newRange.push(originStart as rangeType)
  }
  if (Array.isArray(originEnd[0]) && Array.isArray(originEnd[1])) {
    newRange.push(originEnd[0], originEnd[1])
  } else {
    newRange.push(originEnd as rangeType)
  }

  const range = getRange(...(newRange as rangeType[]))
  return getOriginRange(originTable, range.xRange, range.yRange)
}

/**
 * 判断path是否存在在paths中
 * @param paths
 * @param path
 */
function isIncludePath(paths: Path[], path: Path) {
  for (const p of paths) {
    if (p[0] === path[0] && p[1] === path[1]) return true
  }
  return false
}

/**
 * 根据源表格range获取真实相对paths
 * @param originTable
 * @param range
 */
function getRealRelativePaths(
  originTable: (number | number[])[][][],
  range: tableRange,
) {
  const realPaths: Path[] = []
  const { xRange, yRange } = range
  for (let x = xRange[0]; x <= xRange[1]; x++) {
    for (let y = yRange[0]; y <= yRange[1]; y++) {
      const path = getRealPathByPath(originTable, [x, y])
      if (path && !isIncludePath(realPaths, path)) {
        realPaths.push(path)
      }
    }
  }
  return realPaths
}

/**
 * 根据相对path获取真实path
 * @param relativePaths
 * @param tablePath
 */
function getRealPaths(relativePaths: Path[], tablePath: Path) {
  return relativePaths.map((relativePath) => [...tablePath, ...relativePath])
}

export function getSelection(
  editor: Editor,
  start: Path,
  end: Path,
  table: TableElement,
) {
  const tablePath = ReactEditor.findPath(editor, table)
  const startPath = Path.relative(start, tablePath)
  const endPath = Path.relative(end, tablePath)

  const originTable = getOriginTable(table)
  const originRange = getAllOriginRange(originTable, startPath, endPath) as tableRange

  const realRealtivePaths = getRealRelativePaths(originTable, originRange)
  const realPaths = getRealPaths(realRealtivePaths, tablePath)

  return realPaths
}
