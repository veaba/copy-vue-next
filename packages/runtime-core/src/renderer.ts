import {
  cloneIfMounted,
  Comment,
  createVNode,
  Fragment,
  isSameVNodeType,
  normalizeVNode,
  Static,
  VNode,
  VNodeArrayChildren,
  VNodeHook,
  VNodeNormalizedRef,
  VNodeNormalizedRefAtom
} from './vnode'
import { ComponentInternalInstance, createComponentInstance, Data, setupComponent } from './component'
import { filterSingleRoot, renderComponentRoot, shouldUpdateComponent, updateHOCHostEl } from './componentRenderUtils'
import {
  isString,
  EMPTY_OBJ,
  EMPTY_ARR,
  isArray,
  isReservedProp,
  PatchFlags,
  ShapeFlags,
  hasOwn,
  invokeArrayFns,
  isFunction,
  NOOP
} from '@vue/shared'
import { queueEffectWithSuspense, SuspenseBoundary, SuspenseImpl } from './components/Suspense'
import {
  flushPostFlushCbs,
  flushPreFlushCbs,
  invalidateJob,
  queueJob,
  queuePostFlushCb,
  SchedulerCb
} from './scheduler'
import { effect, isRef, ReactiveEffectOptions, stop } from '@vue/reactivity'
import { createAppAPI, CreateAppFunction } from './apiCreateApp'
import { createHydrationFunctions, RootHydrateFunction } from './hydration'
import { callWithAsyncErrorHandling, callWithErrorHandling, ErrorCodes } from './errorHanding'
import { isTeleportDisabled, TeleportImpl, TeleportVNode } from './components/Teleport'
import { popWarningContext, pushWarningContext, warn } from './warning'
import { isHmrUpdating, registerHMR, unregisterHMR } from './hmr'
import { isKeepAlive, KeepAliveContext } from './components/KeepAlive'
import { endMeasure, startMeasure } from './profiling'
import { devtoolsComponentRemoved, devtoolsComponentUpdated } from './devtools'
import { invokeDirectiveHook } from './directives'
import { updateProps } from './componentProps'
import { updateSlots } from './componentSlots'
import { initFeatureFlags } from './featureFlags'
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

type ProcessTextOrCommentFn = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null
) => void

export type RootRenderFunction<HostElement = RendererElement> = (
  vnode: VNode | null,
  container: HostElement
) => void

export interface Renderer<HostElement = RendererElement> {
  render: RootRenderFunction<HostElement>,
  createApp: CreateAppFunction<HostElement>
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

export const setRef = (
  rawRef: VNodeNormalizedRef,
  oldRawRef: VNodeNormalizedRef | null,
  parentComponent: ComponentInternalInstance,
  parentSuspense: SuspenseBoundary | null,
  vnode: VNode | null
) => {
  if (isArray(rawRef)) {
    rawRef.forEach((r, i) =>
      setRef(
        r,
        oldRawRef && (isArray(oldRawRef) ? oldRawRef[i] : oldRawRef),
        parentComponent,
        parentSuspense,
        vnode
      )
    )
    return
  }
  let value: ComponentInternalInstance | RendererNode | Record<string, any> | null
  if (!vnode) {
    value = null
  } else {
    if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
      value = vnode.component!.exposed || vnode.component!.proxy
    } else {
      value = vnode.el
    }
  }
  const { i: owner, r: ref } = rawRef
  if (__DEV__ && !owner) {
    warn(
      `Missing ref owner context. ref cannot be used on hoisted vnodes. ` +
      `A vnode with ref must be created inside the render function.`
    )
    return
  }
  const oldRef = oldRawRef && (oldRawRef as VNodeNormalizedRefAtom).r
  const refs = owner.refs === EMPTY_OBJ ? (owner.refs = {}) : owner.refs
  const setupState = owner.setupState

  // unset old ref
  if (oldRef != null && oldRef !== ref) {
    if (isString(oldRef)) {
      refs[oldRef] = null
      if (hasOwn(setupState, oldRef)) {
        setupState[oldRef] = null
      }
    } else if (isRef(oldRef)) {
      oldRef.value = null
    }
    if (isString(ref)) {
      const doSet = () => {
        refs[ref] = value
        if (hasOwn(setupState, ref)) {
          setupState[ref] = value
        }
      }
      // #1789 对于非空值，在渲染空值后设置它们，
      // 意味着这是unmount，它不应该覆盖另一个相同键的 ref
      if (value) {
        ;(doSet as SchedulerCb).id = -1
        queuePostRenderEffect(doSet, parentSuspense)
      } else {
        doSet()
      }
    }
  } else if (isRef(ref)) {
    const doSet = () => {
      ref.value = value
    }
    if (value) {
      ;(doSet as SchedulerCb).id = -1
      queuePostRenderEffect(doSet, parentSuspense)
    } else {
      doSet()
    }
  } else if (isFunction(ref)) {
    callWithErrorHandling(ref, parentComponent, ErrorCodes.FUNCTION_REF, [
      value,
      refs
    ])
  } else if (__DEV__) {
    warn('Invalid template ref type:', value, `(${typeof value})`)
  }

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

// https://en.wikipedia.org/wiki/Longest_increasing_subsequence
// 最大递增序列
function getSequence(arr: number[]): number[] {
  const p = arr.slice()
  const result = [0]
  let i, j, u, v, c
  const len = arr.length
  for (i = 0; i < len; i++) {
    const arrI = arr[i]
    if (arrI !== 0) {
      j = result[result.length - 1]
      if (arr[j] < arrI) {
        p[i] = j
        result.push(i)
        continue
      }
      u = 0
      v = result.length - 1
      while (u < v) {
        c = ((u + v) / 2) | 0
        if (arr[result[c]] < arrI) {
          u = c + 1
        } else {
          v = c
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1]
        }
        result[u] = i
      }
    }
  }
  u = result.length
  v = result[u - 1]
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
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

// 用于创建支持水合的渲染器的独立 API。
//  只有在调用这个函数时，才会使用补水逻辑，使之成为树状结构。
export function createHydrationRenderer(
  options: RendererOptions<Node, Element>
) {
  return baseCreateRenderer(options, createHydrationFunctions)
}

function createDevEffectOptions(
  instance: ComponentInternalInstance
): ReactiveEffectOptions {
  return {
    scheduler: queueJob,
    allowRecurse: true,
    onTrack: instance.rtc ? e => invokeArrayFns(instance.rtc!, e) : void 0,
    onTrigger: instance.rtg ? e => invokeArrayFns(instance.rtg!, e) : void 0
  }
}

const prodEffectOptions = {
  scheduler: queueJob,
  // #1801, #2043 组件渲染 effect 应该允许递归更新
  allowRecurse: true
}

// overload 1. no hydration
function baseCreateRenderer<HostNode = RendererNode,
  HostElement = RendererElement>(opts: RendererOptions<HostNode, HostElement>): Renderer<HostElement>

// overload 2. with hydration
function baseCreateRenderer(
  options: RendererOptions<Node, Element>,
  createHydrationFns: typeof createHydrationFunctions
): HydrationRenderer

// baseCreateRenderer 实现
function baseCreateRenderer(
  options: RendererOptions,
  createHydrationFns?: typeof createHydrationFunctions
): any {
  // compile-time feature flags check
  if (__ESM_BUNDLER__ && !__TEST__) {
    initFeatureFlags()
  }

  const {
    insert: hostInsert,
    remove: hostRemove,
    patchProp: hostPatchProp,
    forcePatchProp: hostForcePatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    createComment: hostCreateComment,
    setText: hostSetText,
    setElementText: hostSetElementText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    setScopeId: hostSetScopeId = NOOP,
    cloneNode: hostCloneNode,
    insertStaticContext: hostInsertStaticContent
  } = options

  // 提示：在这个闭包中的函数应该使用 `const xxx = () => {}` 样式，
  // 以防止被 minifiers 内联。
  const patch: PatchFn = (
    n1,
    n2,
    container,
    anchor = null,
    parentComponent = null,
    parentSuspense = null,
    isSVG = false,
    optimized = false
  ) => {
    // 补丁和不一样的类型，卸下旧的树
    if (n1 && !isSameVNodeType(n1, n2)) {
      anchor = getNextHostNode(n1)
      unmount(n1, parentComponent, parentSuspense, true)
      n1 = null
    }
    if (n2.patchFlag === PatchFlags.BAIL) {
      optimized = false
      n2.dynamicChildren = null
    }

    const { type, ref, shapeFlag } = n2
    switch (type) {
      case Text:
        processText(n1, n2, container, anchor)
        break
      case Comment:
        processCommentNode(n1, n2, container, anchor)
        break
      case Static:
        if (n1 == null) {
          mountStaticNode(n2, container, anchor, isSVG)
        } else if (__DEV__) {
          patchStaticNode(n1, n2, container, isSVG)
        }
        break
      case Fragment:
        processFragment(
          n1,
          n2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          optimized
        )
        break
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            optimized
          )
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          processComponent(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            optimized
          )
        } else if (shapeFlag & ShapeFlags.TELEPORT) {
          ;(type as typeof TeleportImpl).process(
            n1 as TeleportVNode,
            n2 as TeleportVNode,
            container, anchor, parentComponent, parentSuspense, isSVG, optimized, internals
          )
        } else if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
          ;(type as typeof SuspenseImpl).process(
            n1,
            n2,
            container, anchor, parentComponent, parentSuspense, isSVG, optimized, internals
          )
        } else if (__DEV__) {
          warn('Invalid VNode type:', type, `(${typeof type})`)
        }
    }
    // set ref
    if (ref != null && parentComponent) {
      setRef(ref, n1 && n1.ref, parentComponent, parentSuspense, n2)
    }
  }
  const processText: ProcessTextOrCommentFn = (n1, n2, container, anchor) => {
    if (n1 == null) {
      hostInsert(
        (n2.el = hostCreateText(n2.children as string)),
        container,
        anchor
      )
    } else {
      const el = (n2.el = n1.el!)
      if (n2.children !== n1.children) {
        hostSetText(el, n2.children as string)
      }
    }
  }

  const processCommentNode: ProcessTextOrCommentFn = (
    n1, n2, container, anchor
  ) => {
    if (n1 == null) {
      hostInsert(
        (n2.el = hostCreateComment((n2.children as string) || '')),
        container,
        anchor
      )
    } else {
      // 不支持动态 comment
      n2.el = n1.el
    }
  }

  const mountStaticNode = (
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    isSVG: boolean
  ) => {
    // 静态节点只有在与 compile-dom/runtime-dom 一起使用时，
    // 才能保证 hostInsertStaticContent 的存在。
    ;[n2.el, n2.anchor] = hostInsertStaticContent!(
      n2.children as string,
      container,
      anchor,
      isSVG
    )
  }
  /**
   * Dev / HMR only
   * */
  const patchStaticNode = (
    n1: VNode,
    n2: VNode,
    container: RendererElement,
    isSVG: boolean
  ) => {
    // 静态节点只在HMR的开发过程中打补丁。
    if (n2.children !== n1.children) {
      const anchor = hostNextSibling(n1.anchor!)
      // 移除已存在的
      removeStaticNode(n1)
      // insert new
      ;[n2.el, n2.anchor] = hostInsertStaticContent!(
        n2.children as string,
        container,
        anchor,
        isSVG
      )
    } else {
      n2.el = n1.el
      n2.anchor = n1.anchor
    }
  }
  /**
   * Dev / HMR only
   * */
  const moveStaticNode = (
    vnode: VNode,
    container: RendererElement,
    anchor: RendererNode | null
  ) => {
    let cur = vnode.el
    const end = vnode.anchor!
    while (cur && cur !== end) {
      const next = hostNextSibling(cur)
      hostInsert(cur, container, anchor)
      cur = next
    }
    hostInsert(end, container, anchor)
  }

  /**
   * Dev / HMR only
   * */
  const removeStaticNode = (vnode: VNode) => {
    let cur = vnode.el
    while (cur && cur !== vnode.anchor) {
      const next = hostNextSibling(cur)
      hostRemove(cur)
      cur = next
    }
    hostRemove(vnode.anchor!)
  }

  const processElement = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    isSVG: boolean,
    optimized: boolean
  ) => {
    isSVG = isSVG || (n2.type as string) == 'svg'
    if (n1 == null) {
      mountElement(
        n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized
      )
    } else {
      patchElement(n1, n2, parentComponent, parentSuspense, isSVG, optimized)
    }
  }
  const mountElement = (
    vnode: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    isSVG: boolean,
    optimized: boolean
  ) => {
    let el: RendererElement
    let vnodeHook: VNodeHook | undefined | null
    const {
      type,
      props,
      shapeFlag,
      transition,
      scopeId,
      patchFlag,
      dirs
    } = vnode
    if (!__DEV__ &&
      vnode.el &&
      hostCloneNode !== undefined &&
      patchFlag === PatchFlags.HOISTED
    ) {
      // 如果一个 vnode 有非空的el，说明它被重用了。
      // 只有静态的 vnodes 可以重复使用，所以其挂载的DOM节点应该是一模一样的，
      // 我们在这里可以简单的做一个克隆。
      // 只有在生产中才这样做，因为克隆的树不能更新HMR。
      el = vnode.el = hostCloneNode(vnode.el)
    } else {
      el = vnode.el = hostCreateElement(
        vnode.type as string,
        isSVG,
        props && props.is
      )
      // 先加载子内容，因为有些prop可能会依赖已经渲染的子内容，例如`<select value>`。
      if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
        hostSetElementText(el, vnode.children as string)
      } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        mountChildren(
          vnode.children as VNodeArrayChildren,
          el,
          null,
          parentComponent,
          parentSuspense,
          isSVG && type !== 'foreignObject',
          optimized || !!vnode.dynamicChildren
        )
      }
      if (dirs) {
        invokeDirectiveHook(vnode, null, parentComponent, 'created')
      }
      // props
      if (props) {
        for (const key in props) {
          if (!isReservedProp(key)) {
            hostPatchProp(
              el, key, null, props[key], isSVG, vnode.children as VNode[],
              parentComponent, parentSuspense, unmountChildren
            )
          }
        }
        if ((vnodeHook = props?.onVnodeBeforeMount)) {
          invokeVNodeHook(vnodeHook, parentComponent, vnode)
        }
      }
      // scopeId
      setScopeId(el, scopeId, vnode, parentComponent)
    }
    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      Object.defineProperty(el, '__vnode', {
        value: vnode,
        enumerable: false
      })

      Object.defineProperty(el, '__vueParentComponent', {
        value: parentComponent,
        enumerable: false
      })
    }

    if (dirs) {
      invokeDirectiveHook(vnode, null, parentComponent, 'beforeMount')
    }

    // #1583 对于内部suspense + suspense 未解决的情况下，输入钩子应该在 suspense 解决时调用。
    // #1689 For inside suspense + suspense resolved case, just call it
    const needCallTransitionHooks =
      (!parentSuspense || (parentSuspense && !parentSuspense.pendingBranch)) &&
      transition &&
      !transition.persisted
    if (needCallTransitionHooks) {
      transition!.beforeEnter(el)
    }
    hostInsert(el, container, anchor)

    if (
      (vnodeHook = props && props.onVnodeMounted) ||
      needCallTransitionHooks ||
      dirs
    ) {
      queuePostRenderEffect(() => {
        vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode)
        needCallTransitionHooks && transition!.enter(el)
        dirs && invokeDirectiveHook(vnode, null, parentComponent, 'mounted')
      }, parentSuspense)
    }
  }
  const setScopeId = (
    el: RendererElement,
    scopeId: string | false | null,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null
  ) => {
    if (scopeId) {
      hostSetScopeId(el, scopeId)
    }

    if (parentComponent) {
      const treeOwnerId = parentComponent.type.__scopeId
      // vnode 自己的 scopeId 和当前打补丁组件的 scopeId 不同, 这是一个 slot 内容节点。
      if (treeOwnerId && treeOwnerId !== scopeId) {
        hostSetScopeId(el, treeOwnerId + '-s')
      }
      let subTree = parentComponent.subTree
      if (__DEV__ && subTree.type === Fragment) {
        subTree = filterSingleRoot(subTree.children as VNodeArrayChildren) || subTree
      }
      if (vnode === subTree) {
        setScopeId(
          el,
          parentComponent.vnode.scopeId,
          parentComponent.vnode,
          parentComponent.parent
        )
      }
    }
  }
  const mountChildren: MountChildrenFn = (
    children,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    isSVG,
    optimized,
    start = 0
  ) => {
    for (let i = start; i < children.length; i++) {
      const child = (children[i] = optimized)
        ? cloneIfMounted(children[i] as VNode)
        : normalizeVNode(children[i])
      patch(null, child, container, anchor, parentComponent, parentSuspense, isSVG, optimized)
    }
  }

  const patchElement = (
    n1: VNode,
    n2: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    isSVG: boolean,
    optimized: boolean
  ) => {
    const el = (n2.el = n1.el!)
    let { patchFlag, dynamicChildren, dirs } = n2
    // 考虑到旧的 vnode 的补丁标志，因为用户可能会克隆一个编译器生成的 vnode，
    // 而这个 vnode 会去掉 opts 到 FULL_PROPS 。
    patchFlag |= n1.patchFlag & PatchFlags.FULL_PROPS
    const oldProps = n1.props || EMPTY_OBJ
    const newProps = n2.props || EMPTY_OBJ
    let vnodeHook: VNodeHook | undefined | null

    if ((vnodeHook = newProps.onVnodeBeforeUpdate)) {
      invokeVNodeHook(vnodeHook, parentComponent, n2, n1)
    }
    if (dirs) {
      invokeDirectiveHook(n2, n1, parentComponent, 'beforeUpdate')
    }

    if (__DEV__ && (__BROWSER__ || __TEST__) && isHmrUpdating) {
      // HRM updated, 强制满diff
      patchFlag = 0
      optimized = false
      dynamicChildren = null
    }
    if (patchFlag > 0) {
      // patchFlag的存在意味着这个元素的渲染代码是由编译器生成的，可以采用快速路径。
      // 在这个路径中，旧节点和新节点保证有相同的形状（即在源模板中完全相同的位置）。
      if (patchFlag & PatchFlags.FULL_PROPS) {
        // element props 包含动态 keys，需要完整的diff
        patchProps(
          el, n2, oldProps, newProps, parentComponent, parentSuspense, isSVG
        )
      } else {
        // class
        // 当元素有动态类绑定时，该标志会被匹配。
        if (patchFlag & PatchFlags.CLASS) {
          if (oldProps.class !== newProps.class) {
            hostPatchProp(el, 'class', null, newProps.class, isSVG)
          }
        }

        // style
        // 当元素有动态样式绑定时，该标志会被匹配。
        if (patchFlag & PatchFlags.STYLE) {
          hostPatchProp(el, 'style', oldProps.style, newProps.style, isSVG)
        }

        // props
        // 当元素有除 class 和 style 以外的动态 prop/attr绑 定时，
        // 会匹配这个标志。动态 prop/attrs 的键被保存起来，以加快迭代速度。
        // 请注意，像 :[foo]="bar" 这样的动态键会导致这个优化失败，并且需要通过一个完整的差异，因为我们需要取消设置旧的键。
        if (patchFlag & PatchFlags.PROPS) {
          // 如果标志存在，那么 dynamicProps 必须为非空。
          const propsToUpdate = n2.dynamicProps!
          for (let i = 0; i < propsToUpdate.length; i++) {
            const key = propsToUpdate[i]
            const prev = oldProps[key]
            const next = newProps[key]
            if (
              next !== prev ||
              (hostForcePatchProp && hostForcePatchProp(el, key))
            ) {
              hostPatchProp(
                el, key, prev, next, isSVG, n1.children as VNode[], parentComponent, parentSuspense, unmountChildren
              )
            }
          }
        }
      }

      // test
      // 当元素只有动态文本子元素时，该标志会被匹配。
      if (patchFlag & PatchFlags.TEXT) {
        if (n1.children !== n2.children) {
          hostSetElementText(el, n2.children as string)
        }
      }
    } else if (!optimized && dynamicChildren == null) {
      // 未优化，full dif
      patchProps(el, n2, oldProps, newProps, parentComponent, parentSuspense, isSVG)
    }
    const areChildrenSVG = isSVG && n2.type !== 'foreignObject'
    if (dynamicChildren) {
      patchBlockChildren(
        n1.dynamicChildren!,
        dynamicChildren,
        el,
        parentComponent,
        parentSuspense,
        areChildrenSVG
      )
      if (__DEV__ &&
        (__BROWSER__ || __TEST__) &&
        parentComponent &&
        parentComponent.type.__hmrId
      ) {
        traverseStaticChildren(n1, n2)
      }
    } else if (!optimized) {
      // full diff
      patchChildren(
        n1, n2, el, null, parentComponent, parentSuspense, areChildrenSVG
      )
    }
    if ((vnodeHook = newProps.onVnodeUpdated) || dirs) {
      queuePostRenderEffect(() => {
        vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, n2, n1)
        dirs && invokeDirectiveHook(n2, n1, parentComponent, 'updated')
      }, parentSuspense)
    }
  }
  // The fast path for blocks
  const patchBlockChildren: PatchBlockChildrenFn = (
    oldChildren,
    newChildren,
    fallbackContainer,
    parentComponent,
    parentSuspense,
    isSVG
  ) => {
    for (let i = 0; i < newChildren.length; i++) {
      const oldVNode = oldChildren[i]
      const newVNode = newChildren[i]
      // 确定补丁的容器（父元素）。
      const container =
        // 在 Fragment 的情况下，我们需要提供 Fragment本 身的实际 parent，以便它可以移动它的 children。
        oldVNode.type === Fragment ||
        //  在不同节点的情况下，会有一个替换，这也需要正确的父容器。
        !isSameVNodeType(oldVNode, newVNode) ||
        // 在组件的情况下，它可以包含任何东西。
        oldVNode.shapeFlag & ShapeFlags.COMPONENT ||
        oldVNode.shapeFlag & ShapeFlags.TELEPORT
          ? hostParentNode(oldVNode.el!)!
          // 在其他情况下，实际上并没有用到父容器，
          // 所以我们只需要在这里传递块元素，以避免DOM parentNode调用。
          : fallbackContainer
      patch(oldVNode, newVNode, container, null, parentComponent, parentSuspense, isSVG, true)
    }
  }
  const patchProps = (
    el: RendererElement,
    vnode: VNode,
    oldProps: Data,
    newProps: Data,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    isSVG: boolean
  ) => {
    if (oldProps !== newProps) {
      for (const key in newProps) {
        // 空字符串是非无效的prop
        if (isReservedProp(key)) continue
        const next = newProps[key]
        const prev = oldProps[key]
        if (
          next !== prev ||
          (hostForcePatchProp && hostForcePatchProp(el, key))
        ) {
          hostPatchProp(
            el, key, prev, next, isSVG, vnode.children as VNode[], parentComponent, parentSuspense, unmountChildren
          )
        }
      }

      if (oldProps !== EMPTY_OBJ) {
        for (const key in oldProps) {
          if (!isReservedProp(key) && !(key in newProps)) {
            hostPatchProp(el, key, oldProps[key], null, isSVG, vnode.children as VNode[], parentComponent, parentSuspense, unmountChildren)
          }
        }
      }
    }
  }
  const processFragment = (
    n1: VNode | null,
    n2: VNode,
    container: RendererNode,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    isSVG: boolean,
    optimized: boolean
  ) => {
    const fragmentStartAnchor = (n2.el = n1 ? n1.el : hostCreateText(''))!
    const fragmentEndAnchor = (n2.anchor = n1 ? n1.anchor : hostCreateText(''))!

    let { patchFlag, dynamicChildren } = n2
    if (patchFlag > 0) {
      optimized = true
    }
    if (__DEV__ && isHmrUpdating) {
      // HMR 更新，强制full diff
      patchFlag = 0
      optimized = false
      dynamicChildren = null
    }

    if (n1 == null) {
      hostInsert(fragmentStartAnchor, container, anchor)
      hostInsert(fragmentEndAnchor, container, anchor)
      // 一个片段只能有数组子代，因为它们要么是由编译器生成的，要么是由数组隐式创建的。
      mountChildren(
        n2.children as VNodeArrayChildren,
        container,
        fragmentEndAnchor,
        parentComponent,
        parentSuspense,
        isSVG,
        optimized
      )
    } else {
      if (patchFlag > 0 && patchFlag & PatchFlags.STABLE_FRAGMENT && dynamicChildren) {
        // 一个稳定的片段（模板根或<template v-for>）不需要打补丁的 children 排序，
        // 它可能包含 dynamicChildren
        patchBlockChildren(n1.dynamicChildren!, dynamicChildren, container, parentComponent, parentSuspense, isSVG)
        if (__DEV__ && parentComponent && parentComponent.type.__hmrId) {
          traverseStaticChildren(n1, n2)
        } else if (
          // #2080 如果稳定的片段有一个键，它是一个<template v-for>，可以是得到移动。确保所有根级vnodes都继承el。
          // #2134 或者如果是组件的根部，它也可能会在组件被移动时被移动。
          n2.key != null ||
          (parentComponent && n2 === parentComponent.subTree)
        ) {
          traverseStaticChildren(n1, n2, true/*shallow*/)
        }
      } else {

        // key/unkeyed ，或手动片段
        // 对于keyed & unkeyed，因为它们是由v-for编译器生成的，
        // 所以保证每个子代都是一个块，所以片段永远不会有dynamicChildren。
        patchChildren(
          n1, n2, container, fragmentEndAnchor, parentComponent, parentSuspense, isSVG, optimized
        )
      }
    }
  }
  const processComponent = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    isSVG: boolean,
    optimized: boolean
  ) => {
    if (n1 == null) {
      if (n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
        ;(parentComponent!.ctx as KeepAliveContext).activate(
          n2, container, anchor, isSVG, optimized
        )
      } else {
        mountComponent(n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized)
      }
    } else {
      updateComponent(n1, n2, optimized)
    }
  }
  const mountComponent: MountComponentFn = (
    initialVNode,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    isSVG,
    optimized
  ) => {
    const instance: ComponentInternalInstance = (initialVNode.component = createComponentInstance(
      initialVNode,
      parentComponent,
      parentSuspense
    ))

    if (__DEV__ && (__BROWSER__ || __TEST__) && instance.type.__hmrId) {
      registerHMR(instance)
    }
    if (__DEV__) {
      pushWarningContext(initialVNode)
      startMeasure(instance, `mount`)
    }
    // 为keepAlive注入渲染器内部结构
    if (isKeepAlive(initialVNode)) {
      ;(instance.ctx as KeepAliveContext).renderer = internals
    }

    // 解决设置上下文的prop和插槽
    if (__DEV__) {
      startMeasure(instance, 'init')
    }
    setupComponent(instance)
    if (__DEV__) {
      endMeasure(instance, 'init')
    }
    // setup() 是异步的，这个组件依靠异步逻辑来解决，然后再继续进行。
    if (__FEATURE_SUSPENSE__ && instance.asyncDep) {
      parentSuspense && parentSuspense.registerDep(instance, setupRenderEffect)

      // 如果这不是补水，就给它一个占位符。
      // TODO handle self-defined fallback
      if (!initialVNode.el) {
        const placeholder = (instance.subTree = createVNode(Comment))
        processCommentNode(null, placeholder, container!, anchor)
      }
      return
    }
    setupRenderEffect(
      instance, initialVNode, container, anchor, parentSuspense, isSVG, optimized
    )
    if (__DEV__) {
      popWarningContext()
      endMeasure(instance, 'mount')
    }
  }
  const updateComponent = (n1: VNode, n2: VNode, optimized: boolean) => {
    const instance = (n2.component = n1.component)!
    if (shouldUpdateComponent(n1, n2, optimized)) {
      if (
        __FEATURE_SUSPENSE__ &&
        !instance.asyncDep &&
        !instance.asyncResolved
      ) {
        // async & still pending - 只是更新prop和插槽，因为组件的渲染响应式 effect 还没有设置。
        if (__DEV__) {
          pushWarningContext(n2)
        }
        updateComponentPreRender(instance, n2, optimized)
        if (__DEV__) {
          popWarningContext()
        }
        return
      } else {
        // 正常更新
        instance.next = n2
        // 如果子组件也在排队，则将其删除，以避免在同一次刷新中重复更新同一个子组件。
        invalidateJob(instance.update)
        // instance.update 是响应式 effect 运行器
        instance.update()
      }
    } else {
      // 不需要更新，仅 copy 覆盖 property
      n2.component = n1.component
      n2.el = n1.el
      instance.vnode = n2
    }
  }
  const setupRenderEffect: SetupRenderEffectFn = (
    instance,
    initialVNode,
    container,
    anchor,
    parentSuspense,
    isSVG,
    optimized
  ) => {
    // 为渲染创建响应式 effect
    instance.update = effect(function componentEffect() {
      if (!instance.isMounted) {
        let vnodeHook: VNodeHook | null | undefined
        const { el, props } = initialVNode
        const { bm, m, parent } = instance

        // beforeMount hook
        if (bm) {
          invokeArrayFns(bm)
        }
        // onVnodeBeforeMount
        if ((vnodeHook = props && props.onVnodeBeforeMount)) {
          invokeVNodeHook(vnodeHook, parent, initialVNode)
        }

        // render
        if (__DEV__) {
          startMeasure(instance, 'render')
        }
        const subTree = (instance.subTree = renderComponentRoot(instance))
        if (__DEV__) {
          endMeasure(instance, 'render')
        }
        if (el && hydrateNode) {
          if (__DEV__) {
            startMeasure(instance, 'hydrate')
          }
          //  vnode已经采用了主机节点--执行水化而不是挂载。
          hydrateNode(
            initialVNode.el as Node,
            subTree,
            instance,
            parentSuspense
          )
          if (__DEV__) {
            endMeasure(instance, 'hydrate')
          }
        } else {
          if (__DEV__) {
            startMeasure(instance, 'patch')
          }
          patch(
            null, subTree, container, anchor, instance, parentSuspense, isSVG
          )
          if (__DEV__) {
            endMeasure(instance, 'patch')
          }
          initialVNode.el = subTree.el
        }
        // mounted hook
        if (m) {
          queuePostRenderEffect(m, parentSuspense)
        }
        // onVnodeMounted
        if ((vnodeHook = props && props.onVnodeMounted)) {
          queuePostRenderEffect(() => {
            invokeVNodeHook(vnodeHook!, parent, initialVNode)
          }, parentSuspense)
        }
        // activated hook ，用于keep-alive root
        // #1742 激活的钩子必须在第一次渲染后被访问，因为钩子可能会被子keep-alive
        const { a } = instance
        if (
          a && initialVNode.shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
        ) {
          queuePostRenderEffect(a, parentSuspense)
        }
        instance.isMounted = true
      } else {
        // updateComponent
        // 这是由组件自身的状态突变（next: null）或父级调用processComponent（next: VNode）触发的。
        let { next, bu, u, parent, vnode } = instance
        let originNext = next
        let vnodeHook: VNodeHook | null | undefined
        if (__DEV__) {
          pushWarningContext(next || instance.vnode)
        }

        if (next) {
          next.el = vnode.el
          updateComponentPreRender(instance, next, optimized)
        } else {
          next = vnode
        }

        // beforeUpdate hook
        if (bu) {
          invokeArrayFns(bu)
        }

        // onVondeBeforeUpdate
        if ((vnodeHook = next.props && next.props.onVnodeBeforeUpdate)) {
          invokeVNodeHook(vnodeHook, parent, next, vnode)
        }
        // render
        if (__DEV__) {
          startMeasure(instance, `render`)
        }

        const nextTree = renderComponentRoot(instance)
        if (__DEV__) {
          endMeasure(instance, `render`)
        }
        const prevTree = instance.subTree
        instance.subTree = nextTree

        if (__DEV__) {
          startMeasure(instance, 'patch')
        }
        patch(
          prevTree, nextTree,
          // 如果在 teleport中，父级可能已经改变
          hostParentNode(prevTree.el!)!,
          // 如果在 fragment中，anchor可能已经改变
          getNextHostNode(prevTree),
          instance,
          parentSuspense,
          isSVG
        )
        if (__DEV__) {
          endMeasure(instance, 'patch')
        }
        next.el = nextTree.el
        if (originNext === null) {
          // 自我触发更新，在HOC的情况下，更新父组件vnode el。
          // HOC由父实例的子树指向子组件的vnode来表示。
          updateHOCHostEl(instance, nextTree.el)
        }
        // updated hook
        if (u) {
          queuePostRenderEffect(u, parentSuspense)
        }
        // onVnodeUpdated
        if ((vnodeHook = next.props && next.props.onVnodeUpdated)) {
          queuePostRenderEffect(() => {
            invokeVNodeHook(vnodeHook!, parent, next!, vnode)
          }, parentSuspense)
        }
        if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
          devtoolsComponentUpdated(instance)
        }
        if (__DEV__) {
          popWarningContext()
        }
      }
    }, __DEV__ ? createDevEffectOptions(instance) : prodEffectOptions)
  }
  const updateComponentPreRender = (
    instance: ComponentInternalInstance,
    nextVNode: VNode,
    optimized: boolean
  ) => {
    nextVNode.component = instance
    const prevProps = instance.vnode.props
    instance.vnode = nextVNode
    instance.next = null
    updateProps(instance, nextVNode.props, prevProps, optimized)
    updateSlots(instance, nextVNode.children)

    // props 更新可能触发了预刷观察者。
    // 在渲染更新前将它们刷新。
    flushPreFlushCbs(undefined, instance.update)
  }
  const patchChildren: PatchChildrenFn = (
    n1,
    n2,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    isSVG,
    optimized = false
  ) => {
    const c1 = n1 && n1.children
    const prevShapeFlag = n1 ? n1.shapeFlag : 0
    const c2 = n2.children

    const { patchFlag, shapeFlag } = n2
    // fast path
    if (patchFlag > 0) {
      if (patchFlag & PatchFlags.KEYED_FRAGMENT) {
        // 这可以是完全键控的，也可以是混合的（有些是键控的，有些是不键控的），
        // patchFlag的存在意味着保证 children 是数组。
        patchKeyedChildren(
          c1 as VNode[],
          c2 as VNodeArrayChildren,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          optimized
        )
        return
      } else if (patchFlag & PatchFlags.UNKEYED_FRAGMENT) {
        // unkeyed
        patchUnkeyedChildren(
          c1 as VNode[],
          c2 as VNodeArrayChildren,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          optimized
        )
        return
      }
    }

    // children 有三个可能：text、array 或者 没有children
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // text children fast path
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(c1 as VNode[], parentComponent, parentSuspense)
      }
      if (c2 !== c1) {
        hostSetElementText(container, c2 as string)
      }
    } else {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // prev children 是 array
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 两个数组，不能假设任何事情，做 full  diff
          patchKeyedChildren(
            c1 as VNode[],
            c2 as VNodeArrayChildren,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            optimized
          )
        } else {
          // 没有新children，仅仅是卸载旧的
          unmountChildren(c1 as VNode[], parentComponent, parentSuspense, true)
        }
      } else {

        // prev children 是 text 或者 null
        // 新的 children 是 array 或null
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          hostSetElementText(container, '')
        }
        // 如果是数组，则 mount
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(
            c2 as VNodeArrayChildren,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            optimized
          )
        }
      }
    }
  }
  const patchUnkeyedChildren = (
    c1: VNode[],
    c2: VNodeArrayChildren,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    isSVG: boolean,
    optimized: boolean
  ) => {
    c1 = c1 || EMPTY_ARR
    c2 = c2 || EMPTY_ARR
    const oldLength = c1.length
    const newLength = c2.length
    const commonLength = Math.min(oldLength, newLength) //比较哪个最小
    let i
    for (i = 0; i < commonLength; i++) {
      const nextChild = (c2[i] = optimized)
        ? cloneIfMounted(c2[i] as VNode)
        : normalizeVNode(c2[i])
      patch(
        c1[i],
        nextChild,
        container,
        null,
        parentComponent,
        parentSuspense,
        isSVG,
        optimized
      )
    }
    if (oldLength > newLength) {
      // remove old
      unmountChildren(
        c1, parentComponent, parentSuspense, true, false, commonLength
      )
    } else {
      // mount new
      mountChildren(
        c2, container, anchor, parentComponent, parentSuspense, isSVG, optimized, commonLength
      )
    }
  }
  //  可以是 all-keyed 的，也可以是混合式的
  const patchKeyedChildren = (
    c1: VNode[],
    c2: VNodeArrayChildren,
    container: RendererElement,
    parentAnchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    isSVG: boolean,
    optimized: boolean
  ) => {
    let i = 0
    const l2 = c2.length
    let e1 = c1.length - 1 // prev ending index
    let e2 = l2 - 1 // next ending index

    // 1. 从start同步
    // (a b) c
    // (a b) d e
    while (i <= e1 && i < e2) {
      const n1 = c1[i]
      const n2 = (c2[i] = optimized
        ? cloneIfMounted(c2[i] as VNode)
        : normalizeVNode(c2[i]))
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, container, null, parentComponent, parentSuspense, isSVG, optimized)
      } else {
        break
      }
      i++
    }

    // 2. 从 end 同步
    // a (b c)
    // d e (b c)
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1]
      const n2 = (c2[e2]) = optimized
        ? cloneIfMounted(c2[e2] as VNode)
        : normalizeVNode(c2[e2])
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, container, null, parentComponent, parentSuspense, isSVG, optimized)
      } else {
        break
      }
      e1--
      e2--
    }
    // 3. 通用 common sequence +mount
    // (a b)
    // (a b) c
    // i=2,e1=1,e2=2
    // (a,b)
    // c (a,b)
    // i=0,e1=-1,e2=0
    if (i > e1) {
      if (i <= e2) {
        const nextPos = e2 + 1
        const anchor = nextPos < l2 ? (c2[nextPos] as VNode).el : parentAnchor
        patch(
          null,
          (c2[i] = optimized
            ? cloneIfMounted(c2[i] as VNode)
            : normalizeVNode(c2[i])),
          container, anchor, parentComponent, parentSuspense, isSVG
        )
        i++
      }
    }
      // 4. common sequence + unmount
      // (a b) c
      // (a b)
      // i = 2, e1 = 2, e2 = 1
      // a (b c)
      // (b c)
    // i = 0, e1 = 0, e2 = -1
    else if (i > e2) {
      while (i <= e1) {
        unmount(c1[i], parentComponent, parentSuspense, true)
        i++
      }
    }
      // 5. unknown sequence
      // [i ... e1 + 1]: a b [c d e] f g
      // [i ... e2 + 1]: a b [e d c h] f g
    // i = 2, e1 = 4, e2 = 5
    else {
      const s1 = i // pre starting index
      const s2 = i // next starting index

      // 5.1  build key:index map for newChildren
      const keyToNewIndexMap: Map<string | number, number> = new Map()
      for (i = s2; i <= e2; i++) {
        const nextChild = (c2[i] = optimized
            ? cloneIfMounted(c2[i] as VNode)
            : normalizeVNode(c2[i])
        )
        if (nextChild.key != null) {
          if (__DEV__ && keyToNewIndexMap.has(nextChild.key)) {
            warn(
              `Duplicate keys found during update:`,
              JSON.stringify(nextChild.key),
              `Make sure keys are unique.`
            )
          }
          keyToNewIndexMap.set(nextChild.key, i)
        }
      }

      // 5.  循环浏览旧的待修补的子节点，并尝试修补匹配的节点和删除不再存在的节点。
      let j
      let patched = 0
      const toBePatched = e2 - s2 + 1
      let moved = false
      // 用于跟踪任何节点是否移动
      let maxNewIndexSoFar = 0
      // 如同 Map<newIndex, oldIndex>
      // 请注意，oldIndex偏移量为+1
      // 和 oldIndex = 0 是一个特殊的值，表示新节点没有对应的旧节点。
      // 用于确定最长稳定子序列
      const newIndexToOldIndexMap = new Array(toBePatched)
      for (i = 0; i < toBePatched; i++) {
        const prevChild = c1[i]
        if (patched >= toBePatched) {
          // 所有新的孩子都被修补了，所以这只能是一个删除
          unmount(prevChild, parentComponent, parentSuspense, true)
          continue
        }
        let newIndex
        if (prevChild.key != null) {
          newIndex = keyToNewIndexMap.get(prevChild.key)
        } else {
          // key-less 节点，尝试定位相同类型的 key-less 节点
          for (j = s2; i <= e2; j++) {
            if (
              newIndexToOldIndexMap[j - s2] === 0 &&
              isSameVNodeType(prevChild, c2[j] as VNode)
            ) {
              newIndex = j
              break
            }
          }
        }
        if (newIndex === undefined) {
          unmount(prevChild, parentComponent, parentSuspense, true)
        } else {
          newIndexToOldIndexMap[newIndex - s2] = i + 1
          if (newIndex >= maxNewIndexSoFar) {
            maxNewIndexSoFar = newIndex
          } else {
            moved = true
          }
          patch(
            prevChild,
            c2[newIndex] as VNode,
            container,
            null,
            parentComponent,
            parentSuspense,
            isSVG,
            optimized
          )
          patched++
        }
      }

      for (i = s1; i <= e1; i++) {
        const prevChild = c1[i]
        if (patched >= toBePatched) {
          // 所有新的 children 都已经打了补丁，所以这只能是一个移除的过程。
          unmount(prevChild, parentComponent, parentSuspense, true)
          continue
        }
        let newIndex
        if (prevChild.key != null) {
          newIndex = keyToNewIndexMap.get(prevChild.key)
        } else {
          // key-less 节点，尝试找到一个相同类型的 key-less 节点。
          for (j = s2; j <= e2; j++) {
            if (newIndexToOldIndexMap[j - s2] === 0 &&
              isSameVNodeType(prevChild, c2[j] as VNode)
            ) {
              newIndex = j
              break
            }
          }
        }
        if (newIndex === undefined) {
          unmount(prevChild, parentComponent, parentSuspense, true)
        } else {
          newIndexToOldIndexMap[newIndex - s2] = i + 1
          if (newIndex >= maxNewIndexSoFar) {
            maxNewIndexSoFar = newIndex
          } else {
            moved = true
          }
          patch(
            prevChild,
            c2[newIndex] as VNode,
            container,
            null,
            parentComponent,
            parentSuspense,
            isSVG,
            optimized
          )
          patched++
        }
      }

      // 5.3 move and mount
      // 仅当节点移动时生成最长稳定子序列
      const increasingNewIndexSequence = moved
        ? getSequence(newIndexToOldIndexMap)
        : EMPTY_ARR
      j = increasingNewIndexSequence.length - 1
      // 向后循环，这样我们就可以使用最后一个打过补丁的节点作为锚。
      for (i = toBePatched - 1; i >= 0; i--) {
        const nextIndex = s2 + i
        const nextChild = c2[nextIndex] as VNode
        const anchor = nextIndex + 1 < l2 ? (c2[nextIndex + 1] as VNode).el :
          parentAnchor
        if (newIndexToOldIndexMap[i] === 0) {
          // mount 新的
          patch(
            null, nextChild, container, anchor, parentComponent, parentSuspense, isSVG
          )
        } else if (moved) {
          //  move if:
          // 没有稳定的子序列（如逆向）或者当前节点不在稳定序列中
          if (j < 0 || i !== increasingNewIndexSequence[j]) {
            move(nextChild, container, anchor, MoveType.REORDER)
          } else {
            j--
          }
        }
      }
    }
  }
  const move: MoveFn = (
    vnode,
    container,
    anchor,
    moveType,
    parentSuspense = null
  ) => {
    const { el, type, transition, children, shapeFlag } = vnode
    if (shapeFlag & ShapeFlags.COMPONENT) {
      move(vnode.component!.subTree, container, anchor, moveType)
      return
    }
    if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
      vnode.suspense!.move(container, anchor, moveType)
      return
    }
    if (shapeFlag & ShapeFlags.TELEPORT) {
      ;(type as typeof TeleportImpl).move(vnode, container, anchor, internals)
      return
    }
    if (type === Fragment) {
      hostInsert(el!, container, anchor)
      for (let i = 0; i < (children as VNode[]).length; i++) {
        move((children as VNode[])[i], container, anchor, moveType)
      }
      hostInsert(vnode.anchor!, container, anchor)
      return
    }

    //  静态节点移动只有在强制更新HMR时才会发生。
    if (__DEV__ && type === Static) {
      moveStaticNode(vnode, container, anchor)
      return
    }
    // single nodes
    const needTransition = moveType !== MoveType.REORDER &&
      shapeFlag & ShapeFlags.ELEMENT &&
      transition
    if (needTransition) {
      if (moveType === MoveType.ENTER) {
        transition!.beforeEnter(el!)
        hostInsert(el!, container, anchor)
        queuePostRenderEffect(() => transition!.enter(el!), parentSuspense)
      } else {
        const { leave, delayLeave, afterLeave } = transition!
        const remove = () => hostInsert(el!, container, anchor)
        const performLeave = () => {
          leave(el!, () => {
            remove()
            afterLeave && afterLeave()
          })
        }
        if (delayLeave) {
          delayLeave(el!, remove, performLeave)
        } else {
          performLeave()
        }
      }
    } else {
      hostInsert(el!, container, anchor)
    }
  }
  const unmount: UnmountFn = (
    vnode,
    parentComponent,
    parentSuspense,
    doRemove,
    optimized
  ) => {
    const {
      type, props, ref, children, dynamicChildren, shapeFlag, patchFlag, dirs
    } = vnode
    // unset ref
    if (ref != null && parentComponent) {
      setRef(ref, null, parentComponent, parentSuspense, null)
    }
    if (shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
      ;(parentComponent!.ctx as KeepAliveContext).deactivate(vnode)
      return
    }
    const shouldInvokeDirs = shapeFlag & ShapeFlags.ELEMENT && dirs
    let vnodeHook: VNodeHook | undefined | null
    if ((vnodeHook = props && props.onVnodeBeforeUnmount)) {
      invokeVNodeHook(vnodeHook, parentComponent, vnode)
    }
    if (shapeFlag & ShapeFlags.COMPONENT) {
      unmountComponent(vnode.component!, parentSuspense, doRemove)
    } else {
      if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
        vnode.suspense!.unmount(parentSuspense, doRemove)
        return
      }
      if (shouldInvokeDirs) {
        invokeDirectiveHook(vnode, null, parentComponent, 'beforeUnmount')
      }
      if (dynamicChildren &&
        //对于不稳定（v-for）碎片，不应采用快速路径
        (type !== Fragment ||
          (patchFlag > 0 && patchFlag & PatchFlags.STABLE_FRAGMENT))
      ) {
        // 块节点的快速路径：只需要卸载动态子节点。
        unmountChildren(
          dynamicChildren,
          parentComponent,
          parentSuspense,
          false,
          true
        )
      } else if (
        (type === Fragment &&
          (patchFlag & PatchFlags.KEYED_FRAGMENT ||
            patchFlag & PatchFlags.UNKEYED_FRAGMENT)) ||
        (!optimized && shapeFlag & ShapeFlags.ARRAY_CHILDREN)
      ) {
        unmountChildren(children as VNode[], parentComponent, parentSuspense)
      }

      // 如果没有被禁用，一个未安装的 Teleport 应该总是移除它的孩children
      if (shapeFlag && ShapeFlags.TELEPORT &&
        (doRemove || !isTeleportDisabled(vnode.props))) {
        ;(vnode.type as typeof TeleportImpl).remove(vnode, internals)
      }
      if (doRemove) {
        remove(vnode)
      }
    }
    if ((vnodeHook = props && props.onVnodeUnmounted) || shouldInvokeDirs) {
      queuePostRenderEffect(() => {
        vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode)
        shouldInvokeDirs &&
        invokeDirectiveHook(vnode, null, parentComponent, 'unmounted')
      }, parentSuspense)
    }
  }
  const remove: RemoveFn = vnode => {
    const { type, el, anchor, transition } = vnode
    if (type === Fragment) {
      removeFragment(el!, anchor!)
      return
    }
    if (__DEV__ && type === Static) {
      removeStaticNode(vnode)
      return
    }

    const performRemove = () => {
      hostRemove(el!)
      if (transition && !transition.persisted && transition.afterLeave) {
        transition.afterLeave()
      }
    }
    if (
      vnode.shapeFlag & ShapeFlags.ELEMENT &&
      transition &&
      !transition.persisted
    ) {
      const { leave, delayLeave } = transition
      const performLeave = () => leave(el!, performRemove)
      if (delayLeave) {
        delayLeave(vnode.el!, performRemove, performLeave)
      } else {
        performLeave()
      }
    } else {
      performRemove()
    }
  }

  const removeFragment = (cur: RendererNode, end: RendererNode) => {
    //  对于片段，直接删除所有包含的DOM节点。(片段子节点不能有过渡)
    let next
    while (cur !== end) {
      next = hostNextSibling(cur)!
      hostRemove(cur)
      cur = next
    }
    hostRemove(end)
  }
  const unmountComponent = (
    instance: ComponentInternalInstance,
    parentSuspense: SuspenseBoundary | null,
    doRemove?: boolean
  ) => {
    if (__DEV__ && (__BROWSER__ || __TEST__) && instance.type.__hmrId) {
      unregisterHMR(instance)
    }
    const { bum, effects, update, subTree, um } = instance
    // beforeUnmount hook
    if (bum) {
      invokeArrayFns(bum)
    }
    if (effects) {
      for (let i = 0; i < effects.length; i++) {
        stop(effects[i])
      }
    }
    // 如果一个组件在其异步 setup 解决之前被卸载，那么update可能为空。
    if (update) {
      stop(update)
      unmount(subTree, instance, parentSuspense, doRemove)
    }
    // unmounted hook
    if (um) {
      queuePostRenderEffect(um, parentSuspense)
    }
    queuePostRenderEffect(() => {
      instance.isUnmounted = true
    }, parentSuspense)

    //  在挂起的 suspense 中有 async dep 的组件在其 async dep 解析之前被卸载。
    //  这应该从suspense中移除该 dep，如果该 dep 是最后一个 dep，则会导致suspense立即解析。
    if (
      __FEATURE_SUSPENSE__ &&
      parentSuspense &&
      parentSuspense.pendingBranch &&
      !parentSuspense.isUnmounted &&
      instance.asyncDep &&
      !instance.asyncResolved &&
      instance.suspenseId === parentSuspense.pendingId
    ) {
      parentSuspense.deps--
      if (parentSuspense.deps === 0) {
        parentSuspense.resolve()
      }
    }
    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      devtoolsComponentRemoved(instance)
    }
  }
  const unmountChildren: UnmountChildrenFn = (
    children,
    parentComponent,
    parentSuspense,
    doRemove,
    optimized,
    start = 0
  ) => {
    for (let i = start; i < children.length; i++) {
      unmount(children[i], parentComponent, parentSuspense, doRemove, optimized)
    }
  }

  const getNextHostNode: NextFn = vnode => {
    if (vnode.shapeFlag & ShapeFlags.COMPONENT) {
      return getNextHostNode(vnode.component!.subTree)
    }
    if (__FEATURE_SUSPENSE__ && vnode.shapeFlag & ShapeFlags.SUSPENSE) {
      return vnode.suspense!.next()
    }
    return hostNextSibling((vnode.anchor || vnode.el)!)
  }
  const render: RootRenderFunction = (vnode, container) => {
    if (vnode == null) {
      if (container._vnode) {
        unmount(container._vnode, null, null, true)
      }
    } else {
      patch(container._vnode || null, vnode, container)
    }
    flushPostFlushCbs()
    container._vnode = vnode
  }

  const internals: RendererInternals = {
    p: patch,
    um: unmount,
    m: move,
    r: remove,
    mt: mountComponent,
    mc: mountChildren,
    pc: patchChildren,
    pbc: patchBlockChildren,
    n: getNextHostNode,
    o: options
  }

  let hydrate: ReturnType<typeof createHydrationFunctions>[0] | undefined
  let hydrateNode: ReturnType<typeof createHydrationFunctions>[1] | undefined
  if (createHydrationFns) {
    ;[hydrate, hydrateNode] = createHydrationFns(internals as RendererInternals<Node,
      Element>)
  }
  return {
    render,
    hydrate,
    createApp: createAppAPI(render, hydrate)
  }
}

/**
 * createRenderer 函数接受两个通用参数。
 * HostNode和HostElement，对应主机环境中的 Node 和 Element类型。
 * 例如，对于运行时域，HostNode 是 DOM 的 `Node` 接口，HostElement 是 DOM 的 `Element` 接口。
 *
 * 自定义渲染器可以传入平台的特定类型，比如这样的类型：
 *
 * ``` js
 * const { render, createApp } = createRenderer<Node, Element>({
 *   patchProp,
 *   ...nodeOps
 * })
 * ```
 */
export function createRenderer<HostNode = RendererNode,
  HostElement = RendererElement>(options: RendererOptions<HostNode, HostElement>) {
  return baseCreateRenderer<HostNode, HostElement>(options)
}
