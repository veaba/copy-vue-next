import { ComponentInternalInstance, openBlock, Slot } from '@vue/runtime-core'
import { currentRenderingInstance, setCurrentRenderingInstance } from '../componentRenderUtils'
import { isRenderingCompiledSlot } from './renderSlot'
import { closeBlock } from '../vnode'

export function withCtx(
  fn: Slot,
  ctx: ComponentInternalInstance | null = currentRenderingInstance
) {
  if (!ctx) return fn
  const renderFnWithContext = (...args: any[]) => {
    // 如果用户在模板表达式里面调用一个编译槽（#1745），就会搞乱块的跟踪，
    // 所以默认情况下，我们需要推送一个空块来避免这种情况。
    // 如果渲染一个编译后的`<slot>`，则不需要这样做。
    if (!isRenderingCompiledSlot) {
      openBlock(true) // null block 禁止跟踪
    }
    const owner = currentRenderingInstance
    setCurrentRenderingInstance(ctx)
    const res = fn(...args)
    setCurrentRenderingInstance(owner)
    if (!isRenderingCompiledSlot) {
      closeBlock()
    }
    return res
  }
  renderFnWithContext._c = true
  return renderFnWithContext
}
