import { RendererElement, VNode } from '@vue/runtime-core'
import { BaseTransitionProps } from '../BaseTransition'

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
