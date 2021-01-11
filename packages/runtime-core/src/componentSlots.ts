import { InternalObjectKey, normalizeVNode, VNode, VNodeChild, VNodeNormalizedChildren } from './vnode'
import { ComponentInternalInstance, currentInstance } from './component'
import { SlotFlags } from '../../shared/src/slotFlags'
import { ShapeFlags } from './shapeFlags'
import { def, isArray, isFunction, isIntegerKey } from '@vue/shared'
import { warn } from './warning'
import { withCtx } from './helpers/withRenderContext'
import { isKeepAlive } from './components/KeepAlive'

export type Slot = (...args: any[]) => VNode[]
export type InternalSlots = {
  [name: string]: Slot | undefined
}
export type Slots = Readonly<InternalSlots>

export type RawSlots = {
  [name: string]: unknown

  // 手动渲染 fn 提示跳过强制 children 更新
  $stable?: boolean
  /**
   * 用于跟踪 slot 主实例。当组件 vnode 被创建时，在 normalizeChildren 期间会附加这个。
   * @internal
   * */
  _ctx?: ComponentInternalInstance | null
  /**
   * 表示编译器生成的 slots 我们使用保留属性而不是 vnode patchFlag，
   * 因为 slots 对象可能会在手动渲染函数中直接传递给子组件，而优化提示需要在 slot 对象本身上被保留。
   * @internal
   * */
  _?: SlotFlags
}

const normalizeSlotValue = (value: unknown): VNode[] =>
  isArray(value)
    ? value.map(normalizeVNode)
    : [normalizeVNode(value as VNodeChild)]

const normalizeSlot = (
  key: string,
  rawSlot: Function,
  ctx: ComponentInternalInstance | null | undefined
): Slot =>
  withCtx((props: any) => {
    if (__DEV__ && currentInstance) {
      warn(
        `Slot "${key}" invoked outside of the render function: ` +
        `this will not track dependencies used in the slot. ` +
        `Invoke the slot function inside the render function instead.`
      )
    }
    return normalizeSlotValue(rawSlot(props))
  }, ctx)

const normalizeObjectSlots = (rawSlots: RawSlots, slots: InternalSlots) => {
  const ctx = rawSlots._ctx
  for (const key in rawSlots) {
    if (isIntegerKey(key)) continue
    const value = rawSlots[key]
    if (isFunction(value)) {
      slots[key] = normalizeSlot(key, value, ctx)
    } else if (value != null) {
      if (__DEV__) {
        warn(
          `Non-function value encountered for slot "${key}". ` +
          `Prefer function slots for better performance.`
        )
        const normalized = normalizeSlotValue(value)
        slots[key] = () => normalized
      }
    }
  }
}
const normalizeVNodeSlots = (
  instance: ComponentInternalInstance,
  children: VNodeNormalizedChildren
) => {
  if (__DEV__ && !isKeepAlive(instance.vnode)) {
    warn(
      `Non-function value encountered for default slot. ` +
      `Prefer function slots for better performance.`
    )
  }
  const normalized = normalizeSlotValue(children)
  instance.slots.default = () => normalized
}

export const initSlots = (
  instance: ComponentInternalInstance,
  children: VNodeNormalizedChildren
) => {
  if (instance.vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    const type = (children as RawSlots)._
    if (type) {
      instance.slots = children as InternalSlots
      //  使编译器的标记变得不可枚举
      def(children as InternalSlots, '_', type)
    } else {
      normalizeObjectSlots(children as RawSlots, (instance.slots = {}))
    }
  } else {
    instance.slots = {}
    if (children) {
      normalizeVNodeSlots(instance, children)
    }
  }
  def(instance.slots, InternalObjectKey, 1)
}
