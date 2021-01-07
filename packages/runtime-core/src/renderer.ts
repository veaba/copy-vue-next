// Renderer Node can technically be any object in the context of core renderer
// logic - they are never directly operated on and always passed to the node op
// functions provided via options, so the internal constraint is really just
// a generic object.
// TODO
import {ComponentInternalInstance} from "./component";
import {SuspenseBoundary} from "./suspense";
import {VNode} from "./vnode";

export interface RendererNode {
    [key: string]: any
}

export interface RendererElement extends RendererNode {
}

export const enum MoveType {
    ENTER = 0,
    LEAVE = 1,
    REORDER = 2
}


export type SetupRenderEffectFn = (
    instance: ComponentInternalInstance,
    initialVNode: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentSuspense: SuspenseBoundary | null,
    isSVG: boolean,
    optimized: boolean
) => void

export const queuePostRenderEffect = __FEATURE_SUSPENSE__
    ? queueEffectWithSuspense
    : queuePostFlushCb
