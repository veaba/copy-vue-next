import { ComponentInternalInstance } from './component'
import { SuspenseBoundary } from './suspense'
import { VNode } from './vnode'
import { queueEffectWithSuspense } from './components/Suspense'
import { queuePostFlushCb } from './scheduler'
import { CreateAppFunction } from './apiCreateApp'

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

export interface Renderer<HostElement = RendererElement> {
  createApp: CreateAppFunction<HostElement>

  render(): RootRenderFunction<HostElement>,
}

export interface HydrationRenderer extends Renderer<Element> {
  hydrate: RootHydrateFunction
}

export interface RendererOptions<HostNode = RendererNode,
  HostElement = RendererElement> {
  patchProp(
    el: HostElement,
    key: string,
    prevValue: any,
    nextValue: any,
    isSVG?: boolean,
    prevChildren?: VNode<HostNode, HostElement>[],
    parentComponent?: ComponentInternalInstance | null,
    parentSuspense?: SuspenseBoundary | null,
    unmountChildren?: UnmountChildrenFn
  ): void

  forcePatchProp?(el: HostElement, key: string): boolean

  insert(el: HostNode, parent: HTMLElement, anchor?: HostNode | null): void

  remove(el: HostNode): void

  createElement(
    type: string,
    isSVG?: boolean,
    isCustomizedBuiltIn?: string
  ): HostElement

  createText(text: string): HostNode

  createComment(text: string): HostNode

  setText(node: HostNode, text: string): void

  setElementText(node: HostNode, text: string): void

  parentNode(node: HostNode): HostNode | null

  nextSibling(node: HostNode): HostNode | null

  querySelector(el: HostElement, id: string): void

  insertStaticContext?(
    content: string,
    parent: HostElement,
    anchor: HostNode | null,
    isSVG: boolean
  ): HostElement[]
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


export type RootRendererFunction<HostElement = RendererElement> = (
  vnode: VNode | null,
  container: HostElement
) => void
