import { ComponentInternalInstance } from './component'
import { SuspenseBoundary } from './components/Suspense'
import { cloneIfMounted, Comment, VNode, VNodeArrayChildren, VNodeHook } from './vnode'
import { queueEffectWithSuspense } from './components/Suspense'
import { queuePostFlushCb } from './scheduler'
import { CreateAppFunction } from './apiCreateApp'
import { isArray } from '@vue/shared'
import { ShapeFlags } from './shapeFlags'
import { PatchFlags } from '../../shared/src/patchFalgs'
import { RootHydrateFunction } from './hydration'
import { callWithAsyncErrorHandling, ErrorCodes } from './errorHanding'

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

export type RootRenderFunction<HostElement = RendererElement> = (
  vnode: VNode | null,
  container: HostElement
) => void

export interface Renderer<HostElement = RendererElement> {
  createApp: CreateAppFunction<HostElement>

  render(): RootRenderFunction<HostElement>,
}

export interface HydrationRenderer extends Renderer<Element> {
  hydrate: RootHydrateFunction
}

type UnmountChildrenFn = (
  children: VNode[],
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  doRemove?: boolean,
  optimized?: boolean,
  start?: number
) => void

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

  insert(el: HostNode, parent: HostElement, anchor?: HostNode | null): void

  remove(el: HostNode): void

  createElement(
    type: string,
    isSVG?: boolean,
    isCustomizedBuiltIn?: string
  ): HostElement

  createText(text: string): HostNode

  createComment(text: string): HostNode

  setText(node: HostNode, text: string): void

  setElementText(node: HostElement, text: string): void

  parentNode(node: HostNode): HostElement | null

  nextSibling(node: HostNode): HostNode | null

  querySelector(selector: string): HostElement | null

  setScopeId?(el: HostElement, id: string): void

  cloneNode?(node: HostNode): HostNode

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

type PatchFn = (
  n1: VNode | null, // null表示这是一个挂载
  n2: VNode,
  container: RendererElement,
  anchor?: RendererNode | null,
  parentComponent?: ComponentInternalInstance | null,
  parentSuspense?: SuspenseBoundary | null,
  isSVG?: boolean,
  optimized?: boolean
) => void

type UnmountFn = (
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  doRemove?: boolean,
  optimized?: boolean
) => void

type RemoveFn = (vnode: VNode) => void
type MoveFn = (
  vnode: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  type: MoveType,
  parentSuspense?: SuspenseBoundary | null
) => void
export type MountComponentFn = (
  initialVNode: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  isSVG: boolean,
  optimized: boolean
) => void
type MountChildrenFn = (
  children: VNodeArrayChildren,
  container: RendererElement,
  anchor: RendererElement | null,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  isSVG: boolean,
  optimized: boolean,
  start?: number
) => void
type PatchChildrenFn = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  isSVG: boolean,
  optimized?: boolean
) => void

type PatchBlockChildrenFn = (
  oldChildren: VNode[],
  newChildren: VNode[],
  fallbackContainer: RendererElement,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  isSVG: boolean
) => void
type NextFn = (vnode: VNode) => RendererNode | null

// 一个暴露渲染器内部的对象，传递给树形摇动器
// 特征，以便它们可以与这个文件解耦。键被缩短为
// 以优化捆绑大小
export interface RendererInternals<HostNode = RendererNode,
  HostElement = RendererElement> {
  p: PatchFn
  um: UnmountFn
  r: RemoveFn
  m: MoveFn
  mt: MountComponentFn
  mc: MountChildrenFn
  pc: PatchChildrenFn
  pbc: PatchBlockChildrenFn
  n: NextFn
  o: RendererOptions<HostNode, HostElement>
}

/**
 * @todo
 * #1156
 * 当一个组件启用HMR时，我们需要确保所有的静态节点。
 * 块内的DOM元素也继承了前一棵树上的DOM元素，所以
 * HMR更新(是完整的更新)可以检索元素进行修补。
 *
 * #2080
 * 如果一个片段被移动，在带键的`模板`片段静态子片段内。
 * 子女总是会被移动，所以需要继承以前节点的el。
 * 以确保正确的移动位置。
 */
export function traverseStaticChildren(n1: VNode, n2: VNode, shallow = false) {
  const ch1 = n1.children
  const ch2 = n2.children
  if (isArray(ch1) && isArray(ch2)) {
    for (let i = 0; i < ch1.length; i++) {
      // 这只在优化后的路径中被调用，所以数组的孩子是
      // 保证是vnodes
      const c1 = ch1[i] as VNode
      let c2 = ch2[2] as VNode
      if (c2.shapeFlag & ShapeFlags.ELEMENT && !c2.dynamicChildren) {
        if (c2.patchFlag <= 0 || c2.patchFlag === PatchFlags.HYDRATE_EVENTS) {
          c2 = ch2[i] = cloneIfMounted(ch2[i] as VNode)
          c2.el = c1.el
        }
        if (!shallow) traverseStaticChildren(c1, c2)
      }

      // 也继承注释节点，但不继承占位符（例如 v-if which
      // 将在区块补丁期间收到.el)
      if (__DEV__ && c2.type === Comment && !c2.el) {
        c2.el = c1.el
      }
    }
  }
}

export function invokeVNodeHook(
  hook: VNodeHook,
  instance: ComponentInternalInstance | null,
  vnode: VNode,
  prevVNode: VNode | null = null
) {
  callWithAsyncErrorHandling(hook, instance, ErrorCodes.VNODE_HOOK, [
    vnode,
    prevVNode
  ])
}

