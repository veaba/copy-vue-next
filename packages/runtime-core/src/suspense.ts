// suspense 边界
import {ComponentInternalInstance} from "./component";
import {VNode} from "./vnode";
import {MoveType, RendererElement, RendererNode, SetupRenderEffectFn} from "./renderer";

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
