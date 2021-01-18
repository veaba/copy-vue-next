import { isProxy, ReactiveFlags, Ref, toRaw } from '@vue/reactivity'
import { ClassComponent, ComponentInternalInstance, ConcreteComponent, Data, isClassComponent } from './component'
import { RendererElement, RendererNode } from './renderer'
import { DirectiveBinding } from './directives'
import { TransitionHooks } from './components/BaseTransition'
import { isSuspense, normalizeSuspenseChildren, SuspenseBoundary } from './components/Suspense'
import { AppContext } from './apiCreateApp'
import { RawSlots } from './componentSlots'
import { normalizeClass, normalizeStyle } from '../../shared/src/normalizeProp'
import { currentRenderingInstance } from './componentRenderUtils'
import { warn } from './warning'
import { isFunction, isObject, isString, PatchFlags, ShapeFlags, SlotFlags } from '@vue/shared'
import { currentScopeId } from './helpers/scopeId'
import { EMPTY_ARR, extend, isArray, isOn } from '@vue/shared'
import { setCompiledSlotRendering } from './helpers/renderSlot'
import { isTeleport } from './components/Teleport'
import { NULL_DYNAMIC_COMPONENT } from './helpers/resolveAssets'
import { hmrDirtyComponents } from './hmr'


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

const createVNodeWithArgsTransform = (
  ...args: Parameters<typeof _createVNode>
): VNode => {
  return _createVNode(
    ...(vnodeArgsTransformer
      ? vnodeArgsTransformer(args, currentRenderingInstance)
      : args)
  )
}

export function mergeProps(...args: (Data & VNodeProps)[]) {
  const ret = extend({}, args[0])
  for (let i = 0; i < args.length; i++) {
    const toMerge = args[i]
    for (const key in toMerge) {
      if (key === 'class') {
        if (ret.class !== toMerge.class) {
          ret.class = normalizeClass([ret.class, toMerge.class])
        }
      } else if (key === 'style') {
        ret.style = normalizeStyle([ret.style, toMerge.style])
      } else if (isOn(key)) {
        const existing = ret[key]
        const incoming = toMerge[key]
        if (existing !== incoming) {
          ret[key] = existing
            ? [].concat(existing as any, toMerge[key] as any)
            : incoming
        }
      } else if (key !== '') {
        ret[key] = toMerge[key]
      }
    }
  }
  return ret
}

const normalizeKey = ({ key }: VNodeProps): VNode['key'] => key != null ? key : null

const normalizeRef = ({ ref }: VNodeProps): VNodeNormalizedRefAtom | null => {
  return (ref != null
    ? isArray(ref) ? ref : { i: currentRenderingInstance, r: ref } : null) as any
}
export const Fragment = (Symbol(__DEV__ ? 'Fragment' : undefined) as any) as {
  __isFragment: true
  new(): {
    $props: VNodeProps
  }
}

export function cloneVNode<T, U>(
  vnode: VNode<T, U>,
  extraProps?: Data & VNodeProps | null,
  mergeRef = false
): VNode<T, U> {
  // 这是故意不使用 spread 或 extension 来避免运行时 key 枚举成本。
  const { props, ref, patchFlag } = vnode
  const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props
  return {
    __v_isVNode: true,
    [ReactiveFlags.SKIP]: true,
    type: vnode.type,
    props: mergedProps,
    key: mergedProps && normalizeKey(mergedProps),
    ref:
      extraProps && extraProps.ref
        ?
        mergeRef && ref
          ? isArray(ref)
          ? ref.concat(normalizeRef(extraProps)!)
          : [ref, normalizeRef(extraProps)!]
          : normalizeRef(extraProps)
        : ref,
    scopeId: vnode.scopeId,
    children: vnode.children,
    target: vnode.target,
    targetAnchor: vnode.targetAnchor,
    staticCount: vnode.staticCount,
    shapeFlag: vnode.shapeFlag,
    // 如果 vnode 是用额外的 props克 隆的，我们就不能再假设它现有的补丁标志是可靠的，需要添加 `FULL_PROPS` 标志。
    // 注意：对碎片的持久化标志，因为他们只对 children 快速路径使用标志。
    patchFlag:
      extraProps && vnode.type !== Fragment
        ? patchFlag === -1  // hoisted node
        ? PatchFlags.FULL_PROPS
        : patchFlag | PatchFlags.FULL_PROPS
        : patchFlag,
    dynamicProps: vnode.dynamicProps,
    dynamicChildren: vnode.dynamicChildren,
    appContext: vnode.appContext,
    dirs: vnode.dirs,
    transition: vnode.transition,

    // 从技术上讲，这些应该只在挂载的VNodes上是非空的。然而
    // 它们*应该被复制到保持活力的vnodes上。
    // 所以我们只是一直复制它们，因为它们在挂载过程中是非空的，不会影响逻辑，因为它们会被简单地覆盖。
    component: vnode.component,
    suspense: vnode.suspense,
    ssContent: vnode.ssContent && cloneVNode(vnode.ssContent),
    ssFallback: vnode.ssFallback && cloneVNode(vnode.ssFallback),
    el: vnode.el,
    anchor: vnode.anchor
  }
}

// 由于 `v-if` 和 `v-for` 是节点结构动态变化的两种可能方式，一旦我们考虑 `v-if` 分支，
// 每个 `v-for` 片段为一个块，
// 我们就可以将一个模板划分为嵌套块，在每个块内，节点结构将是稳定的。
// 这样我们就可以跳过大部分的子节点diff，只担心动态节点（用补丁标志表示）。
export const blockStack: (VNode[] | null)[] = []
let currentBlock: VNode[] | null = null

export function closeBlock() {
  blockStack.pop()
  currentBlock = blockStack[blockStack.length - 1] || null
}

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
  return asBlock
    ? (openBlock(), createBlock(Comment, null, text))
    : createVNode(Comment, null, text)
}

export const InternalObjectKey = `__vInternal`

export function normalizeChildren(vnode: VNode, children: unknown) {
  let type = 0
  const { shapeFlag } = vnode
  if (children == null) {
    children = null
  } else if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN
    // TOTO: 此处判断条件跟 official 不一样
  } else if (isObject(children)) {
    if (shapeFlag & ShapeFlags.ELEMENT || shapeFlag & ShapeFlags.TELEPORT) {
      // 将 slot 规范化为普通children和teleport的普通children
      const slot = (children as any).default
      if (slot) {
        // _withCtx() 添加了_c标记，表示这是一个已编译的插槽
        slot._c && setCompiledSlotRendering(1)
        normalizeChildren(vnode, slot())
        slot._c && setCompiledSlotRendering(-1)
      }
      return
    } else {
      type = ShapeFlags.SLOTS_CHILDREN
      const slotFlag = (children as RawSlots)._
      if (!slotFlag && !(InternalObjectKey in children!)) {
        // 如果slot 未规范化，请附上下文实例 (compiled/normalized slot 已有上下文)
        ;(children as RawSlots)._ctx = currentRenderingInstance
      } else if (slotFlag === SlotFlags.FORWARDED && currentRenderingInstance) {
        // child component 从 parent 接收转发slot
        // 它的槽类型由它的父槽类型决定。
        if (currentRenderingInstance.vnode.patchFlag & PatchFlags.DYNAMIC_SLOTS) {
          ;(children as RawSlots)._ = SlotFlags.DYNAMIC
          vnode.patchFlag |= PatchFlags.DYNAMIC_SLOTS
        } else {
          ;(children as RawSlots)._ = SlotFlags.STABLE
        }
      }
    }
  } else if (isFunction(children)) {
    children = { default: children, _ctx: currentRenderingInstance }
    type = ShapeFlags.SLOTS_CHILDREN
  } else {
    children = String(children)
    // 强制 teleport children 到 数组，这样它就可以移动
    if (shapeFlag & ShapeFlags.TELEPORT) {
      type = ShapeFlags.ARRAY_CHILDREN
      children = [createTextVNode(children as string)]
    } else {
      type = ShapeFlags.TEXT_CHILDREN
    }
  }
  vnode.children = children as VNodeNormalizedChildren
  vnode.shapeFlag |= type
}

/**
 * @private
 * */
export function createStaticVNode(
  content: string,
  numberOfNodes: number
): VNode {
  // 一个静态的 vnode 可以包含多个 stringified element，元素的数量是必要的 hydration
  const vnode = createVNode(Static, null, content)
  vnode.staticCount = numberOfNodes
  return vnode
}

export const createVNode = (__DEV__ ? createVNodeWithArgsTransform : _createVNode) as typeof _createVNode

function _createVNode(
  type: VNodeTypes | ClassComponent | typeof NULL_DYNAMIC_COMPONENT,
  props: (Data & VNodeTypes) | null = null,
  children: unknown = null,
  patchFlag: number = 0,
  dynamicProps: string[] | null = null,
  isBlockNode = false
): VNode {
  if (!type || type === NULL_DYNAMIC_COMPONENT) {
    // 无效的 vnode type
    if (__DEV__ && !type) {
      warn(`Invalid vnode type when creating vnode: ${type}.`)
    }
    type = Comment
  }

  if (isVNode(type)) {
    // createVNode接收一个现有的vnode。这发生在
    // 像<component :is="vnode"/>这样的情况下。
    // #2078 确保在克隆过程中合并refs，而不是覆盖它。
    const cloned = cloneVNode(type, props, true) /*mergeRef:true*/
    if (children) {
      normalizeChildren(cloned, children)
    }
    return cloned
  }

  // class component 规范化
  if (isClassComponent(type)) {
    type = type.__vccOpts
  }

  // class & style 规范化
  if (props) {
    // 用于响应式或者proxy 对象，我们需要clone 它来启用变更
    if (isProxy(props) || InternalObjectKey in props) {
      props = extend({}, props)
    }
    let { class: klass, style } = props
    if (klass && !isString(klass)) {
      props.class = normalizeClass(klass)
    }
    if (isObject(style)) {
      // 响应式状态对象需要被克隆，因为它们很可能会被改变
      if (isProxy(style) && !isArray(style)) {
        style = extend({}, style)
      }
      props.style = normalizeStyle(style)
    }
  }

  // 将vnode类型信息编码成位图。
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : __FEATURE_SUSPENSE__ && isSuspense(type)
      ? ShapeFlags.SUSPENSE
      : isTeleport(type)
        ? ShapeFlags.TELEPORT
        : isObject(type)
          ? ShapeFlags.STATEFUL_COMPONENT
          : isFunction(type)
            ? ShapeFlags.FUNCTIONAL_COMPONENT
            : 0
  if (__DEV__ && shapeFlag & ShapeFlags.STATEFUL_COMPONENT && isProxy(type)) {
    type = toRaw(type)
    warn(
      `Vue received a Component which was made a reactive object. This can ` +
      `lead to unnecessary performance overhead, and should be avoided by ` +
      `marking the component with \`markRaw\` or using \`shallowRef\` ` +
      `instead of \`ref\`.`,
      `\nComponent that was made reactive: `,
      type
    )
  }

  const vnode: VNode = {
    __v_isVNode: true,
    [ReactiveFlags.SKIP]: true,
    type,
    props,
    key: props && normalizeKey(props),
    ref: props && normalizeRef(props),
    scopeId: currentScopeId,
    children: null,
    component: null,
    suspense: null,
    ssContent: null,
    ssFallback: null,
    dirs: null,
    transition: null,
    el: null,
    anchor: null,
    target: null,
    targetAnchor: null,
    staticCount: 0,
    shapeFlag,
    patchFlag,
    dynamicProps,
    dynamicChildren: null,
    appContext: null
  }

  // 无效key
  if (__DEV__ && vnode.key !== vnode.key) {
    warn(`VNode created with invalid key (NaN). VNode type:`, vnode.type)
  }

  normalizeChildren(vnode, children)

  // 规范化 suspense children
  if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
    const { content, fallback } = normalizeSuspenseChildren(vnode)
    vnode.ssContent = content
    vnode.ssFallback = fallback
  }

  if (shouldTrack > 0 &&
    // 避免一个block 节点自我跟踪
    !isBlockNode &&
    // 有当前的 parent block
    currentBlock &&
    //补丁标志的存在表明这个节点需要在更新时打补丁。
    // 组件节点也应该总是被打上补丁，因为即使是
    // 组件不需要更新，它需要将实例持久化到
    // 下一个vnode，这样以后就可以正确地卸载它。
    (patchFlag > 0 || shapeFlag && ShapeFlags.COMPONENT) &&
    // EVENTS 标志只用于水合，如果它是唯一的标志，那么
    //由于处理程序缓存，vnode不应该被认为是动态的。
    patchFlag !== PatchFlags.HYDRATE_EVENTS
  ) {
    currentBlock.push(vnode)
  }
  return vnode
}

let vnodeArgsTransformer:
  | ((
  args: Parameters<typeof _createVNode>,
  instance: ComponentInternalInstance | null
) => Parameters<typeof _createVNode>)
  | undefined

/**
 * 内部 API，用于为createVNode注册一个参数转换，用于在test-utils中创建存根。
 * 它是 *内部的* ，但需要暴露出来，以便测试工具能够接收到正确的拼写。
 *
 * */
export function transformVNodeArgs(transformer?: typeof vnodeArgsTransformer) {
  vnodeArgsTransformer = transformer
}

export function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  if (__DEV__ &&
    n2.shapeFlag & ShapeFlags.COMPONENT &&
    hmrDirtyComponents.has(n2.type as ConcreteComponent)) {
    // HRM only: 如果这个组件已 热更新，则强制reload
    return false
  }
  return n1.type === n2.type && n1.key === n2.key
}

//
export function cloneIfMounted(child: VNode): VNode {
  return child.el === null ? child : cloneVNode(child)
}
