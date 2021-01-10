import { SuspenseBoundary, SuspenseProps } from '../suspense'
import {isArray} from "@vue/shared";
import {queuePostFlushCb} from "../scheduler";
import { ComponentInternalInstance, RendererElement, RendererNode, VNode } from '@vue/runtime-core'
import { MoveType, SetupRenderEffectFn } from '../renderer'

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

export interface SuspenseProps {
  onResolve?: () => void
  onPending?: () => void
  onFallback?: () => void
  timeout?: string | number
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
