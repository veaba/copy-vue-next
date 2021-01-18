import { toHandlerKey, warn } from '@vue/runtime-core'
import { isObject } from '@vue/shared'

/**
 * 用于 前缀 key 中 v-on="obj" with "on"
 * @private
 * */
export function toHandlers(obj: Record<string, any>): Record<string, any> {
  const ret: Record<string, any> = {}
  if (__DEV__ && !isObject(obj)) {
    warn(`v-on with no argument expects an object value.`)
    return ret
  }
  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue
    ret[toHandlerKey(key)] = obj[key]
  }
  return ret
}
