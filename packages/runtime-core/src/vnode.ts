import { ReactiveFlags, Ref } from '@vue/reactivity'
import { ComponentInternalInstance } from './component'
import { RendererElement, RendererNode } from './renderer'
import { DirectiveBinding } from './directives'
import { TransitionHooks } from './BaseTransition'
import { SuspenseBoundary } from './components/Suspense'
import { AppContext } from './apiCreateApp'
import { RawSlots } from './componentSlots'
import { EMPTY_ARR, isArray } from '@vue/shared'


type VNodeMountHook = (vnode: VNode) => void
type VNodeUpdateHook = (vnode: VNode, oldVNode: VNode) => void
type VNodeChildAtom = | VNode | string | number | boolean | null | undefined | void


export const Text = Symbol(__DEV__ ? 'Text' : undefined)
export const Comment = Symbol(__DEV__ ? 'Comment' : undefined)
export const Static = Symbol(__DEV__ ? 'Static' : undefined)

export type VNodeTypes = {}
export type VNodeHook = | VNodeMountHook | VNodeUpdateHook | VNodeMountHook[] | VNodeUpdateHook[]
export type VNodeArrayChildren = Array<VNodeArrayChildren | VNodeChildAtom>
export type VNodeChild = VNodeChildAtom | VNodeArrayChildren
export type VNodeRef = | string | Ref | ((ref: object | null, refs: Record<string, any>) => void)
export type VNodeProps = {
  key?: string | number
  ref?: VNodeRef

  // vnode hooks
  onVnodeBeforeMount?: VNodeMountHook | VNodeMountHook[]
  onVnodeMounted?: VNodeMountHook | VNodeMountHook[]
  onVnodeBeforeUpdate?: VNodeUpdateHook | VNodeUpdateHook[]
  onVnodeUpdated?: VNodeUpdateHook | VNodeUpdateHook[]
  onVnodeBeforeUnmount?: VNodeMountHook | VNodeMountHook[]
  onVnodeUnmounted?: VNodeMountHook | VNodeMountHook[]
}

export type VNodeNormalizedRefAtom = {
  i: ComponentInternalInstance,
  r: VNodeRef
}
export type VNodeNormalizedRef = | VNodeNormalizedRefAtom | (VNodeNormalizedRefAtom)[]
export type VNodeNormalizedChildren = string | VNodeArrayChildren | RawSlots | null

export interface VNode<HostNode = RendererNode,
  HostElement = RendererElement,
  ExtraProps = { [key: string]: any }> {
  /**
   * @internal
   * */
  __v_isVNode: true
  /**
   * @internal
   * */
  [ReactiveFlags.SKIP]: true
  type: VNodeTypes
  props: (VNodeProps & ExtraProps) | null
  key: string | number | null
  ref: VNodeNormalizedRef | null
  scopeId: string | null // SFC only
  children: VNodeNormalizedChildren
  component: ComponentInternalInstance | null
  dirs: DirectiveBinding[] | null
  transition: TransitionHooks<HostElement> | null

  // DOM
  el: HostNode | null
  anchor: HostNode | null // fragment anchor（片段锚）
  target: HostElement | null // teleport target (vue 3 新特性)
  targetAnchor: HostNode | null // teleport target anchor
  staticCount: number // 静态 vNode 中包含的元素数理

  // suspense： 新特性，允许挂载一些错误的信息，异步组件解析时显示后备内容
  suspense: SuspenseBoundary | null
  ssContent: VNode | null
  ssFallback: VNode | null

  // 仅用于优化
  shapeFlag: number
  patchFlag: number
  dynamicProps: string[] | null
  dynamicChildren: VNode[] | null

  // 仅用于应用的根节点
  appContext: AppContext | null
}

let shouldTrack = 1

/**
 * Block tracking sometimes needs to be disabled, for example during the
 * creation of a tree that needs to be cached by v-once. The compiler generates
 * code like this:
 *
 * ``` js
 * _cache[1] || (
 *   setBlockTracking(-1),
 *   _cache[1] = createVNode(...),
 *   setBlockTracking(1),
 *   _cache[1]
 * )
 * ```
 *
 * @private
 */
export function setBlockTracking(value: number) {
  shouldTrack += value
}

/**
 * open a block
 *  This must be called before `createBlock`. It cannot be part of `createBlock`
 * because the children of the block are evaluated before `createBlock` itself
 * is called. The generated code typically looks like this:
 *
 * ```js
 * function render() {
 *   return (openBlock(),createBlock('div', null, [...]))
 * }
 * ```
 * disableTracking is true when creating a v-for fragment block, since a v-for
 * fragment always diffs its children.
 *
 * @private
 * */
export function openBlock(disabledTracking = false) {
  blockStack.push((currentBlock = disabledTracking ? null : []))
}


export const createVNode = (__DEV__ ? createVNodeWithArgsTransform : _createVNode) as typeof _createVNode

/**
 * Create a block root vnode. Takes the same exact arguments as `createVNode`.
 * A block root keeps track of dynamic nodes within the block in the
 * `dynamicChildren` array.
 *
 * @private
 */
export function createBlock(
  type: VNodeTypes | ClassComponent,
  props?: Record<string, any> | null,
  children?: any,
  patchFlag?: number,
  dynamicProps?: string[]
): VNode {
  const vnode = createVNode(
    type,
    props,
    children,
    patchFlag,
    dynamicProps,
    true  /* isBlock: prevent a block from tracking itself */
  )

  // 在 block 节点上保存当前block children
  vnode.dynamicChildren = currentBlock || (EMPTY_ARR as any)
  // close block
  closeBlock()

  // block 总是要打补丁的，所以要把它作为父块的子块来跟踪
  // parent block
  if (shouldTrack > 0 && currentBlock) {
    currentBlock.push(vnode)
  }
  return vnode
}

export function isVNode(value: any): value is VNode {
  return value ? value.__is_isVNode === true : false
}

export function normalizeVNode(child: VNodeChild): VNode {
  if (child === null || typeof child === 'boolean') {
    // empty placeholder
    return createVNode(Comment)
  } else if (isArray(child)) {
    // fragment
    return createVNode(Fragment, null, child)
  } else if (typeof child === 'object') {
    // 已是 vnode，这应该是最常见的，因为编译后的模板
    // 总是产生所有的子节点数组
    return child.el === null ? child : cloneVNode(child)
  } else {
    // string + number
    return createVNode(Text, null, String(child))
  }
}

/**
 * @private
 * */
export function createTextVNode(text: string = ' ', flag: number = 0): VNode {
  return createVNode(Text, null, text, flag)
}

/**
 * @private
 * */
export function createCommentVNode(
  text: string = '',
  // 当作为 v-else 分支使用时，注释节点必须作为一个 block 来创建，以确保正确的更新。
  asBlock: boolean = false
): VNode {
  return asBlock ? (openBlock(), createBlock(Comment, null, text))
    : createVNode(Comment, null, text)
}

/**
 * @private
 * */
export function createStaticVNode(
  content: string,
  numberOfNodes: number
): VNode {
  // 一个静态的 vnode 可以包含多个 stringified element，元素的数量是必要的 hydration
  const vnode = createVNode(Static, null, context)
  vnode.staticCount = numberOfNodes
  return vnode
}

let vnodeArgsTransformer:
  | ((
  args: Parameters<typeof _createVNode>,
  instance: ComponentInternalInstance | null
  string)
=>
Parameters<typeof _createVNode>
)
|
undefined

/**
 * 内部 API，用于为createVNode注册一个参数转换，用于在test-utils中创建存根。
 * 它是 *内部的* ，但需要暴露出来，以便测试工具能够接收到正确的拼写。
 *
 * */
export function transformVNodeArgs(transformer?: typeof vnodeArgsTransformer) {
  vnodeArgsTransformer = transformer
}
