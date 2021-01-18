/**
 * 实际实现
 * */
import { VNodeChild } from '@vue/runtime-core'
import { isArray, isObject, isString } from '@vue/shared'
import { warn } from '@vue/runtime-core'

/**
 * @param  source type: array,number,object
 * @param renderItem
 * */
export function renderList(
  source: any,
  renderItem: (...args: any[]) => VNodeChild
): VNodeChild[] {
  let ret: VNodeChild[]
  if (isArray(source) || isString(source)) {
    ret = new Array(source.length)
    for (let i = 0, l = source.length; i < l; i++) {
      ret[i] = renderItem(source[i], i)
    }
  } else if (typeof source === 'number') {
    if (__DEV__ && !Number.isInteger(source)) {
      warn(`The v-for range expect an integer value but got ${source}.`)
      return []
    }
    ret = new Array(source)
    for (let i = 0; i < source; i++) {
      ret[i] = renderItem(i + 1, i)
    }
  } else if (isObject(source)) {
    if (source[Symbol.iterator as any]) {
      ret = Array.from(source as Iterable<any>, renderItem)
    } else {
      const keys = Object.keys(source)
      ret = new Array(keys.length)
      for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i]
        ret[i] = renderItem(source[key], key, i)
      }
    }
  } else {
    ret = []
  }
  return ret
}
