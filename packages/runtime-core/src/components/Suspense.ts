import { isArray, isFunction, toNumber } from '@vue/shared'
import { queuePostFlushCb } from '../scheduler'
import {
  ComponentInternalInstance, ErrorCodes, handleError,
  RendererElement,
  RendererNode,
  Slots,
  VNode,
  VNodeChild, VNodeProps,
  warn
} from '@vue/runtime-core'
import { MoveType, RendererInternals, SetupRenderEffectFn } from '../renderer'
import { ShapeFlags } from '../../../shared/src/shapeFlags'
import { isSameVNodeType, normalizeVNode } from '../vnode'
import { filterSingleRoot, updateHOCHostEl } from '../componentRenderUtils'
import { effect } from '@vue/reactivity'
import { popWarningContext, pushWarningContext } from '../warning'
import { handleSetupResult } from '../component'

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

function setActiveBranch(suspense: SuspenseBoundary, branch: VNode) {
  suspense.activeBranch = branch
  const { vnode, parentComponent } = suspense
  const el = (vnode.el = branch.el)
  //如果 suspense 是组件的根节点，
  //递归更新HOC el
  if (parentComponent && parentComponent.subTree === vnode) {
    parentComponent.vnode.el = el
    updateHOCHostEl(parentComponent, el)
  }
}

let hasWarned = false

function createSuspenseBoundary(
  vnode: VNode,
  parent: SuspenseBoundary | null,
  parentComponent: ComponentInternalInstance | null,
  container: RendererElement,
  hiddenContainer: RendererElement,
  anchor: RendererNode | null,
  isSVG: boolean,
  optimized: boolean,
  rendererInternals: RendererInternals,
  isHydrating = false
): SuspenseBoundary {
  /* istanbul ignore if*/
  if (__DEV__ && !__TEST__ && !hasWarned) {
    hasWarned = true
    // @ts-ignore `console.info` cannot be null error
    console[console.info ? 'info' : 'log'](
      `<Suspense> is an experimental feature and its API will likely change.`
    )
  }

  const {
    p: patch,
    m: move,
    um: unmount,
    n: next,
    o: { parentNode, remove }
  } = rendererInternals

  const timeout = toNumber(vnode.props && vnode.props.timeout)
  const suspense: SuspenseBoundary = {
    vnode,
    parent,
    parentComponent,
    isSVG,
    container,
    hiddenContainer,
    anchor,
    deps: 0,
    pendingId: 0,
    timeout: typeof timeout === 'number' ? timeout : -1,
    activeBranch: null,
    pendingBranch: null,
    isInFallback: true,
    isHydrating,
    isUnmounted: false,
    effects: [],

    resolve(resume = false) {
      if (__DEV__) {
        if (!resume && !suspense.pendingBranch) {
          throw new Error(
            `suspense.resolve() is called without a pending branch.`
          )
        }
        if (suspense.isUnmounted) {
          // 在已卸载的 suspense 边界上调用
          throw new Error(
            `suspense.resolve() is called on an already unmounted suspense boundary.`
          )
        }
      }
      const {
        vnode,
        activeBranch,
        pendingBranch,
        pendingId,
        effects,
        parentComponent,
        container
      } = suspense

      if (suspense.isHydrating) {
        suspense.isHydrating = false
      } else if (!resume) {
        const delayEnter = activeBranch &&
          pendingBranch!.transition &&
          pendingBranch!.transition.mode === 'out-in'
        if (delayEnter) {
          activeBranch!.transition!.afterLeave = () => {
            if (pendingId === suspense.pendingId) {
              move(pendingBranch!, container, anchor, MoveType.ENTER)
            }
          }
        }

        // mount 上初始化 anchor
        let { anchor } = suspense
        // unmount 当前active tree
        if (activeBranch) {
          // 如果安装了 fallback 树，它可能已经被移动了。
          // 作为父 suspense 的一部分，获取最新的锚点以便插入
          anchor = next(activeBranch)
          unmount(activeBranch, parentComponent, suspense, true)
        }
        if (!delayEnter) {
          // 将内容从非本体容器转移到实际容器中去。
          move(pendingBranch!, container, anchor, MoveType.ENTER)
        }
      }

      setActiveBranch(suspense, pendingBranch!)
      suspense.pendingBranch = null
      suspense.isInFallback = false

      // 冲洗缓冲效果
      // 检查是否有一个待定的父级悬念。
      let parent = suspense.parent
      let hasUnresolvedAncestor = false
      while (parent) {
        if (parent.pendingBranch) {
          // 发现一个待处理的上级悬念，合并缓冲后的岗位工作。
          // 进入parent
          parent.effects.push(...effects)
          hasUnresolvedAncestor = true
          break
        }
        parent = parent.parent
      }
      // no pending parent suspense, flush all jobs
      if (!hasUnresolvedAncestor) {
        queuePostFlushCb(effect)
      }
      suspense.effects = []

      // invoke @resolve  event
      const onResolve = vnode.props && vnode.props.onResolve
      if (isFunction(onResolve)) {
        onResolve()
      }
    },
    fallback(fallbackVNode: VNode) {
      if (!suspense.pendingBranch) {
        return
      }
      const {
        vnode,
        activeBranch,
        parentComponent,
        container,
        isSVG
      } = suspense

      // invoke @fallback event
      const onFallback = vnode.props && vnode.props.onFallback
      if (isFunction(onFallback)) {
        onFallback()
      }

      const anchor = next(activeBranch!)
      const mountFallback = () => {
        if (!suspense.isInFallback) {
          return
        }
        // mount the fallback tree
        patch(
          null,
          fallbackVNode,
          container,
          anchor,
          parentComponent,
          null, // fallback tree 没有suspense 上下文
          isSVG
        )
        setActiveBranch(suspense, fallbackVNode)
      }
      const delayEnter = fallbackVNode.transition && fallbackVNode.transition.mode === 'out-in'
      if (delayEnter) {
        activeBranch!.transition!.afterLeave = mountFallback
      }

      // 卸载当前激活的branch
      unmount(
        activeBranch!,
        parentComponent,
        null, // 没有suspense,所以卸载 hooks fire now
        true // 应该移除
      )
      suspense.isInFallback = true
      if (!delayEnter) {
        mountFallback()
      }
    },
    move(container, anchor, type) {
      suspense.activeBranch && move(suspense.activeBranch, container, anchor, type)
      suspense.container = container
    },
    next() {
      return suspense.activeBranch && next(suspense.activeBranch)
    },
    registerDep(instance: ComponentInternalInstance, setupRenderEffect: SetupRenderEffectFn) {
      if (!suspense.pendingBranch) {
        return
      }
      const hydrateEl = instance.vnode.el
      suspense.deps++
      instance.asyncDep!.catch(err => {
        handleError(err, instance, ErrorCodes.SETUP_FUNCTION)
      })
        .then(asyncSetupResult => {
          // 当setup()承诺解决时重试。
          // 组件可能在解决之前被卸载。
          if (instance.isUnmounted ||
            suspense.isUnmounted ||
            suspense.pendingId !== instance.suspenseId) {
            return
          }
          suspense.deps++
          // 从组件重试
          instance.asyncResolved = true
          const { vnode } = instance
          if (__DEV__) {
            pushWarningContext(vnode)
          }
          handleSetupResult(instance, asyncSetupResult, false)
          if (hydrateEl) {
            // 如果在更新之前发生了更新，vnode可能已经被替换。
            // async dep 已经 resolved
            vnode.el = hydrateEl
          }
          const placeholder = !hydrateEl && instance.subTree.el
          setupRenderEffect(
            instance,
            vnode,
            // 组件在解析前可能已经被移动。
            // 如果这不是一个水合，instance.subTree将成为注释。
            // 占位符。
            parentNode(hydrateEl || instance.subTree.el!)!,
            // 如果是补水的话，不会使用锚，所以只需要用
            //考虑评论占位符的情况。
            hydrateEl ? null : next(instance.subTree),
            suspense,
            isSVG,
            optimized
          )
          if (placeholder) {
            remove(placeholder)
          }
          updateHOCHostEl(instance, vnode.el)
          {
            if (__DEV__) {
              popWarningContext()
            }
            if (suspense.deps === 0) {
              suspense.resolve()
            }
          }
        })
    },
    unmount(parentSuspense: SuspenseBoundary | null, doRemove?: boolean) {
      suspense.isUnmounted = true
      if (suspense.activeBranch) {
        unmount(
          suspense.activeBranch,
          parentComponent,
          parentSuspense,
          doRemove
        )
      }
      if (suspense.pendingBranch) {
        unmount(
          suspense.pendingBranch,
          parentComponent,
          parentSuspense,
          doRemove
        )
      }
    }
  }
  return suspense
}

function mountSuspense(
  vnode: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  isSVG: boolean,
  optimized: boolean,
  rendererInternals: RendererInternals
) {
  const {
    p: patch,
    o: { createElement }
  } = rendererInternals
  const hiddenContainer = createElement('div')
  const suspense = (vnode.suspense = createSuspenseBoundary(
    vnode,
    parentSuspense,
    parentComponent,
    container,
    hiddenContainer,
    anchor,
    isSVG,
    optimized,
    rendererInternals
  ))

  // 开始将内容子树挂载到一个非主体容器中
  patch(
    null,
    (suspense.pendingBranch = vnode.ssContent!),
    hiddenContainer,
    null,
    parentComponent,
    suspense,
    isSVG
  )
  // 现在检查我们是否遇到了任何异步 deps
  if (suspense.deps > 0) {
    // 存在异步
    // 挂载 fallback tree
    patch(
      null,
      vnode.ssFallback!,
      container,
      anchor,
      parentComponent,
      null, // fallback tree 将不存在suspense 上下文
      isSVG
    )
    setActiveBranch(suspense, vnode.ssFallback!)
  } else {
    // Suspense 有非异步的 deps. Just resolve
    suspense.resolve()
  }
}

function hydrateSuspense(
  node: Node,
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  isSVG: boolean,
  optimized: boolean,
  rendererInternals: RendererInternals,
  hydrateNode: (
    node: Node,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    optimized: boolean
  ) => Node | null
): Node | null {
  /* eslint-disable no-restricted-globals */
  const suspense = (vnode.suspense = createSuspenseBoundary(
    vnode,
    parentSuspense,
    parentComponent,
    node.parentNode!,
    document.createElement('div'),
    null,
    isSVG,
    optimized,
    rendererInternals,
    true /*hydrating*/
  ))
  // 对于服务器渲染的悬念，有两种可能的情况。
  // - 成功： ssr内容应该被完全解析了
  // - 失败：ssr内容应该是后备分支。
  // 然而，在客户端，我们并不真正知道它是否失败了
  // 尝试给DOM补水，假设成功了，但我们仍然要
  // 需要先构建一个suspense边界。
  const result = hydrateNode(
    node,
    (suspense.pendingBranch = vnode.ssContent!),
    parentComponent,
    suspense,
    optimized
  )
  if (suspense.deps === 0) {
    suspense.resolve()
  }
  return result
}

function patchSuspense(
  n1: VNode,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  isSVG: boolean,
  {
    p: patch, um: unmount, o: { createElement }
  }: RendererInternals
) {
  const suspense = (n2.suspense = n1.suspense)!
  suspense.vnode = n2
  n2.el = n1.el
  const newBranch = n2.ssContent!
  const newFallback = n2.ssFallback!

  const { activeBranch, pendingBranch, isInFallback, isHydrating } = suspense
  if (pendingBranch) {
    suspense.pendingBranch = newBranch
    if (isSameVNodeType(newBranch, pendingBranch)) {
      // 同样的根型，但内容可能已经改变。
      patch(
        pendingBranch,
        newBranch,
        suspense.hiddenContainer,
        null,
        parentComponent,
        suspense,
        isSVG
      )
      if (suspense.deps <= 0) {
        suspense.resolve()
      } else if (isInFallback) {
        patch(
          activeBranch,
          newFallback,
          container,
          anchor,
          parentComponent, // fallback 树不会有悬念上下文。
          null,
          isSVG
        )
        setActiveBranch(suspense, newFallback)
      }
    } else {
      // 在resolve pending tree之前 toggle
      suspense.pendingId++
      if (isHydrating) {
        // 如果在水合作用完成之前切换，则当前DOM树不再有效，
        // 将其设置为活动分支，以便在解析时解除挂载。
        suspense.isHydrating = false
        suspense.activeBranch = pendingBranch
      } else {
        unmount(pendingBranch, parentComponent, suspense)
      }
      // 递增挂起的ID，用于使异步回调无效，重置暂停状态
      suspense.deps = 0
      // 抛弃待定分支的影响
      suspense.effects.length = 0
      // 丢弃前一个容器
      suspense.hiddenContainer = createElement('div')

      if (isInFallback) {
        // 已处于回退状态
        patch(
          null,
          newBranch,
          suspense.hiddenContainer,
          null,
          parentComponent,
          suspense,
          isSVG
        )
        if (suspense.deps <= 0) {
          suspense.resolve()
        } else {
          patch(
            activeBranch,
            newBranch,
            container,
            anchor,
            parentComponent, // fallback tree 没有 suspense 上下文
            null,
            isSVG
          )
          setActiveBranch(suspense, newBranch)
        }
      } else if (activeBranch && isSameVNodeType(newBranch, activeBranch)) {
        // toggled "back" to current active branch
        patch(
          activeBranch,
          newBranch,
          container,
          anchor,
          parentComponent,
          suspense,
          isSVG
        )

        // 强制resolve
        suspense.resolve(true)
      } else {
        // switch 到第三个branch
        patch(
          null,
          newBranch,
          suspense.hiddenContainer,
          null,
          parentComponent,
          suspense,
          isSVG
        )
        if (suspense.deps <= 0) {
          suspense.resolve()
        }
      }
    }
  } else {
    if (activeBranch && isSameVNodeType(newBranch, activeBranch)) {
      // root 没有改变，只是正常的patch
      patch(
        activeBranch,
        newBranch,
        container,
        anchor,
        parentComponent,
        suspense,
        isSVG
      )
      setActiveBranch(suspense, newBranch)
    } else {
      // root node toggled
      // 调用 @pending event
      const onPending = n2.props && n2.props.onPending
      if (isFunction(onPending)) {
        onPending()
      }

      // 在非dom容器中挂载pending的分支
      suspense.pendingBranch = newBranch
      suspense.pendingId++
      patch(
        null,
        newBranch,
        suspense.hiddenContainer,
        null,
        parentComponent,
        suspense,
        isSVG
      )
      if (suspense.deps <= 0) {
        // 传入分支没有异步dep，请立即resolve
        suspense.resolve()
      } else {
        const { timeout, pendingId } = suspense
        if (timeout < 0) {
          setTimeout(() => {
            if (suspense.pendingId === pendingId) {
              suspense.fallback(newFallback)
            }
          }, timeout)
        } else if (timeout === 0) {
          suspense.fallback(newFallback)
        }
      }
    }
  }
}

// Suspense公开了一个类似组件的API，并被视为一个组件
// 在编译器中，但在内部，它是一个特殊的内置类型，可以钩住
// 直接进入渲染器。
export const SuspenseImpl = {
  // 为了使Suspense成为树状结构的，我们需要避免导入它。
  // 直接在渲染器中进行。渲染器会检查 __isSuspense 标志。
  // 在vnode的类型上调用 "process"方法，并传入渲染器。
  // 内部的。
  __isSuspense: true,
  process(
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parenComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    isSVG: boolean,
    optimized: boolean,
    // 从渲染器传递平台指定 impl
    rendererInternals: RendererInternals
  ) {
    if (n1 == null) {
      mountSuspense(
        n2,
        container,
        anchor,
        parenComponent,
        parentSuspense,
        isSVG,
        optimized,
        rendererInternals
      )
    } else {
      patchSuspense(
        n1,
        n2,
        container,
        anchor,
        parenComponent,
        isSVG,
        rendererInternals
      )
    }
  },
  hydrate: hydrateSuspense,
  create: createSuspenseBoundary
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
