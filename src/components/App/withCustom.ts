import { Editor } from 'slate'
import ee from 'event-emitter'

const withCustom = <T extends Editor>(editor: T) => {
  const e = editor
  const { onChange } = e
  const emitter = ee()

  e.tableState = {
    showSelection: false,
    selection: [],
  }

  e.on = (type, listener) => {
    emitter.on(type, listener)
  }
  e.once = (type, listener) => {
    emitter.once(type, listener)
  }
  e.off = (type, listener) => {
    emitter.off(type, listener)
  }
  e.emit = (type, ...args: any[]) => {
    emitter.emit(type, ...args)
  }

  e.onChange = () => {
    e.emit('change')
    // 必须调用
    onChange()
  }

  return e
}
export default withCustom