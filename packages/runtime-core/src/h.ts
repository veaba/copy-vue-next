// 实际实现
import { createVNode, isVNode, VNode } from './vnode'
import { isArray, isObject } from '@vue/shared'

export function h(type: any, propsOrChildren?: any, children?: any): VNode {
  const l = arguments.length
  // 根据参数的长度来知道是否含有children
  if (l === 2) {
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      // 单 vnode 没有props
      if (isVNode(propsOrChildren)) {
        return createVNode(type, null, [propsOrChildren])
      }
      // props 没有 children
      return createVNode(type, propsOrChildren)
    } else {
      // omit props(省略props)
      return createVNode(type, null, propsOrChildren)
    }
  } else {
    if (l > 3) {
      // Array.prototype.slice.call() 将具有length 对象(key 为数字)转为数组
      children = Array.prototype.slice.call(arguments, 2)
    } else if (l === 3 && isVNode(children)) {
      children = [children]
    }
    return createVNode(type, propsOrChildren, children)
  }
}
