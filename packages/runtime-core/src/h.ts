// 实际实现
import { createVNode, Fragment, isVNode, VNode, VNodeArrayChildren, VNodeProps } from './vnode'
import { isArray, isObject } from '@vue/shared'
import { RawSlots } from './componentSlots'
import { Teleport, TeleportProps } from './components/Teleport'
import { Suspense, SuspenseProps } from './components/Suspense'
import { EmitsOptions } from './componentEmits'
import { Component, ConcreteComponent, FunctionalComponent } from './component'
import { ComponentOptions } from './componentOptions'
import { DefineComponent } from './apiDefineComponent'

type RawProps = VNodeProps & {
  // 用于与作为子对象的单个VNode对象 diff
  __v_isVNode?: never
  // 从 Array children 用于 diff
  [Symbol.iterator]?: never
} & Record<string, any>

type RawChildren =
  | string
  | number
  | boolean
  | VNode
  | VNodeArrayChildren
  | (() => any)

// 从 "defineComponent "返回的假构造函数类型。
interface Constructor<P = any> {
  __isFragment?: never
  __isTeleport?: never
  ___isSuspense?: never

  new(...args: any[]): { $props: P }
}

/**
 * `h`是`createVNode`的一个更方便用户使用的版本，允许尽可能省略props。
 * 它适用于手动编写的渲染函数。
 * 编译器生成的代码使用`createVNode`是因为:
 * 1. 它是单态的，避免了额外的调用开销。
 * 2. 它允许指定用于优化的patchFlags
 * -------------------------------------
 * 1. type only
 * h('iv')
 *
 * 2. type+props
 * h('div',{})
 *
 * 3. type+omit props+ children
 * 省略 props不支持命名槽
 * h('div',[])      // array
 * h('div','foo')   // text
 * h('div',h('br')  // vnode
 * h(Component,()=>{}) // default slot
 *
 * 4. type+props +children
 * h('div',{},[])         // array
 * h('div',{},'foo')      // text
 * h('div',{},h('br'))    // vnode
 * h(Component,{},()=>{}) // 默认 slot
 * h(Component,{},{})     // 具名 slots
 *
 * 5. 没有props的命名 slot 需要显式的 `null` 以避免歧义
 * h(Component,null,{})
 * */

// 以下是一系列的重载，用于为手动编写的渲染函数提供props验证。

// element
export function h(type: string, children?: RawChildren): VNode
export function h(type: string, props?: RawProps | null, children?: RawChildren | RawSlots): VNode

// fragment
export function h(type: typeof Fragment, children?: VNodeArrayChildren): VNode
export function h(type: typeof Fragment, props?: RawProps | null, children?: VNodeArrayChildren): VNode

// teleport (目标的prop是需要的)
export function h(
  type: typeof Teleport,
  props: RawProps & TeleportProps,
  children: RawChildren
): VNode

// suspense
export function h(type: typeof Suspense, children?: RawChildren): VNode
export function h(
  type: typeof Suspense,
  props?: (RawProps & SuspenseProps) | null,
  children?: RawChildren | RawSlots
): VNode

// functional component
export function h<P, E extends EmitsOptions = {}>(
  type: FunctionalComponent<P, E>,
  props?: (RawProps & P) | ({} extends P ? null : never),
  children?: RawChildren | RawSlots
): VNode

// 全部捕获的泛型组件类型
export function h(type: Component, children?: RawChildren): VNode

// concrete component (混泥土组件？)
export function h<P>(
  type: ConcreteComponent | string,
  children?: RawChildren
): VNode
export function h<P>(
  type: ConcreteComponent<P> | string,
  props?: (RawProps & P) | ({} extends P ? null : never),
  children?: RawChildren
): VNode

// 组件没有 props
export function h(
  type: Component,
  props: null,
  children?: RawChildren | RawSlots
): VNode

// 排斥 `defineComponent` 构造器
export function h<P>(
  type: ComponentOptions<P>,
  props?: (RawProps & P) | ({} extends P ? null : never),
  children?: RawChildren | RawSlots
): VNode

// 通过 `defineComponent` 或者  class 组件返回的假构造器类型
export function h(type: Constructor, children?: RawChildren): VNode
export function h<P>(
  type: Constructor<P>,
  props?: (RawProps & P) | ({} extends P ? null : never),
  children?: RawChildren | RawSlots
): VNode

// `defineComponent` 返回的假的构造器类型
export function h(
  type: DefineComponent, children?: RawChildren
): VNode
export function h<P>(
  type: DefineComponent<P>,
  props?: (RawProps & P) | ({} extends P ? null : never),
  children?: RawChildren | RawSlots
): VNode

// 实际实现
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
