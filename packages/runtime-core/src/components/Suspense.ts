import { isArray, isFunction } from '@vue/shared'
import { queuePostFlushCb } from '../scheduler'
import {
  ComponentInternalInstance,
  RendererElement,
  RendererNode,
  Slots,
  VNode,
  VNodeChild, VNodeProps,
  warn
} from '@vue/runtime-core'
import { MoveType, SetupRenderEffectFn } from '../renderer'
import { ShapeFlags } from '../shapeFlags'
import { normalizeVNode } from '../vnode'
import { filterSingleRoot } from '../componentRenderUtils'

export function queueEffectWithSuspense(
  fn: Function | Function[],
  suspense: SuspenseBoundary | null
): void {
  if (suspense && suspense.pendingBranch) {
    if (isArray(fn)) {
      suspense.effects.push(...fn)
    } else {
      suspense.effects.push(fn)
    }
  } else {
    queuePostFlushCb(fn)
  }
}

export const isSuspense = (type: any): boolean => type.__isSuspense

export interface SuspenseProps {
  onResolve?: () => void
  onPending?: () => void
  onFallback?: () => void
  timeout?: string | number
}

// Force-casted public typing for h and TSX props inference
export const Suspense = ((__FEATURE_SUSPENSE__
  ? SuspenseImpl
  : null) as any) as {
  __isSuspense: true
  new(): { $props: VNodeProps & SuspenseProps }
}

export interface SuspenseBoundary {
  vnode: VNode<RendererNode, RendererElement, SuspenseProps>
  parent: SuspenseBoundary | null
  parentComponent: ComponentInternalInstance | null
  isSVG: boolean
  container: RendererElement
  hiddenContainer: RendererElement
  anchor: RendererNode | null
  activeBranch: VNode | null
  pendingBranch: VNode | null
  deps: number
  pendingId: number
  timeout: number
  isInFallback: boolean
  isHydrating: boolean
  isUnmounted: boolean
  effects: Function[]

  resolve(force?: boolean): void

  fallback(fallbackVNode: VNode): void

  move(
    container: RendererElement,
    anchor: RendererNode | null,
    type: MoveType
  ): void

  next(): RendererNode | null

  registerDep(
    instance: ComponentInternalInstance,
    setupRenderEffect: SetupRenderEffectFn
  ): void

  unmount(parentSuspense: SuspenseBoundary | null, doRemove?: boolean): void
}


function normalizeSuspenseSlot(s: any) {
  if (isFunction(s)) {
    s = s()
  }
  if (isArray(s)) {
    const singleChild = filterSingleRoot(s)
    if (__DEV__ && !singleChild) {
      warn(`<Suspense> slots expect a single root node.`)
    }
    s = singleChild
  }
  return normalizeVNode(s)
}

export function normalizeSuspenseChildren(
  vnode: VNode
): {
  content: VNode,
  fallback: VNode
} {
  const { shapeFlag, children } = vnode
  let content: VNode
  let fallback: VNode
  if (shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    content = normalizeSuspenseSlot((children as Slots).default)
    fallback = normalizeSuspenseSlot((children as Slots).fallback)
  } else {
    content = normalizeSuspenseSlot(children as VNodeChild)
    fallback = normalizeVNode(null)
  }
  return {
    content,
    fallback
  }
}
