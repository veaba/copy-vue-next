import { RendererElement, VNode } from '@vue/runtime-core'
import { BaseTransitionProps } from '../BaseTransition'
import { ShapeFlags } from '../shapeFlags'

export interface TransitionState {
  isMounted: boolean
  isLeaving: boolean
  inUnmounting: boolean
  // 追踪同 key的children pending level 的回调
  // 这是在进入新副本时，用来强制移除遗留的children
  leavingVNodes: Map<any, Record<string, VNode>>
}

export interface TransitionHooks<HostElement extends RendererElement = RendererElement> {
  mode: BaseTransitionProps['mode']
  persisted: boolean

  beforeEnter(el: HostElement): void

  enter(el: HostElement): void

  leave(el: HostElement, remove: () => void): void

  clone(vnode: VNode): TransitionHooks<HostElement>

  // 可选
  afterLeave?(): void

  delayLeave?(
    el: HostElement,
    earlyRemove: () => void,
    delayedLeave: () => void
  ): void

  delayedLeave?(): void
}

export interface BaseTransitionProps<HostElement = RendererElement> {
  mode?: 'in-out' | 'out-in' | 'default'
  appear?: boolean

  // 如果为真，表示这是一个过渡，实际上并没有插入/删除元素，而是切换了显示/隐藏状态。
  // 注入了过渡钩子，但会被渲染器跳过。相反，一个自定义指令可以通过调用注入的钩子（如v-show）来控制过渡。
  // 注入钩子 (e.g. v-show)
  persisted?: boolean
  // 钩子。在呈现函数&JSX中使用camel-case更容易使用。
  // 在模板中，这些可以写为@before enter=“xxx”，因为 prop 的名称是驼峰化的。
  onBeforeEnter?: (el: HostElement) => void
  onEnter?: (el: HostElement, done: () => void) => void
  onAfterEnter?: (el: HostElement) => void
  onEnterCancelled?: (el: HostElement) => void

  // leave
  onBeforeLeave?: (el: HostElement) => void
  onLeave?: (el: HostElement, done: () => void) => void
  onAfterLeave?: (el: HostElement) => void
  onLeaveCancelled?: (el: HostElement) => void // 仅在持久模式下激发

  // appear
  onBeforeAppear?: (el: HostElement) => void
  onAppear?: (el: HostElement, done: () => void) => void
  onAfterAppear?: (el: HostElement) => void
  onAppearCancelled?: (el: HostElement) => void
}

// export the public type for h/tsx inference
// also to avoid inline import() in generated d.ts files
export const BaseTransition = (BaseTransitionImpl as any) as {
  new(): {
    $props: BaseTransitionProps<any>
  }
}

export function setTransitionHooks(vnode: VNode, hooks: TransitionHooks) {
  if (vnode.shapeFlag & ShapeFlags.COMPONENT && vnode.component) {
    setTransitionHooks(vnode.component.subTree, hooks)
  } else if (__FEATURE_SUSPENSE__ && vnode.shapeFlag & ShapeFlags.SUSPENSE) {
    vnode.ssContent!.transition = hooks.clone(vnode.ssContent!)
    vnode.ssFallback!.transition = hooks.clone(vnode.ssFallback!)
  } else {
    vnode.transition = hooks
  }
}
