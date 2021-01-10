import {ComponentInternalInstance} from "./component";
import {SuspenseBoundary} from "./suspense";
import {VNode} from "./vnode";
import {queueEffectWithSuspense} from "./components/Suspense";
import {queuePostFlushCb} from "./scheduler";

// 渲染器节点在技术上可以是核心渲染器逻辑上下文中的任何对象--它们从来没有被直接操作过，
// 总是通过选项传递给提供的节点操作函数，所以内部约束实际上只是一个通用对象。
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

//
