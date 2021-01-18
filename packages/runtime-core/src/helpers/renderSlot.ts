/**
 * compiler runtime helper 用于rendering `<slot/>`
 * @private
 * */
import { createBlock, Fragment, openBlock, Slots, VNode, VNodeArrayChildren } from '@vue/runtime-core'
import { Data } from '../component'
import { warn } from '@vue/runtime-core'
import { SlotFlags } from '../../../shared/src/slotFlags'
import { PatchFlags } from '../../../shared/src/patchFalgs'
import { RawSlots } from '../componentSlots'

export let isRenderingCompiledSlot = 0
export const setCompiledSlotRendering = (n: number) => (isRenderingCompiledSlot += n)

export function renderSlot(
  slots: Slots,
  name: string,
  props: Data = {},
  fallback?: () => VNodeArrayChildren
): VNode {
  let slot = slots[name]
  if (__DEV__ && slot && slot.length > 1) {
    warn(
      `SSR-optimized slot function detected in a non-SSR-optimized render ` +
      `function. You need to mark this component with $dynamic-slots in the ` +
      `parent template.`
    )
    slot = () => []
  }

  isRenderingCompiledSlot++
  /**
   * @diff 这种写法似乎始终只返回最后一个
   * called renderSlot()(parma)
   * */
  const rendered = (openBlock(),
    createBlock(
      Fragment,
      {
        key: props.key
      },
      slot ? slot(props) : fallback ? fallback() : [],
      (slots as RawSlots)._ === SlotFlags.STABLE ?
        PatchFlags.STABLE_FRAGMENT
        : PatchFlags.BAIL
    ))
  isRenderingCompiledSlot--
  return rendered
}
