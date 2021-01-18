import {
  callWithAsyncErrorHandling, cloneVNode, Comment,
  ComponentInternalInstance,
  ErrorCodes, Fragment, getCurrentInstance, onBeforeUnmount, onMounted,
  RendererElement, SetupContext, toRaw,
  VNode, VNodeArrayChildren
} from '@vue/runtime-core'
import { ShapeFlags } from '../shapeFlags'
import { isSameVNodeType } from '../vnode'
import { warn } from '../warning'
import { PatchFlags } from '../../../shared/src/patchFalgs'
import { isKeepAlive } from './KeepAlive'

export interface TransitionState {
  isMounted: boolean
  isLeaving: boolean
  isUnmounting: boolean
  // 追踪同 key的children pending level 的回调
  // 这是在进入新副本时，用来强制移除遗留的children
  leavingVNodes: Map<any, Record<string, VNode>>
}

type TransitionHookCaller = (
  hook: ((el: any) => void) | undefined,
  args?: any[]
) => void

export function useTransitionState(): TransitionState {
  const state: TransitionState = {
    isMounted: false,
    isLeaving: false,
    isUnmounting: false,
    leavingVNodes: new Map()
  }
  onMounted(() => {
    state.isMounted = true
  })
  onBeforeUnmount(() => {
    state.isUnmounting = true
  })
  return state
}

export interface TransitionHooks<HostElement extends RendererElement = RendererElement> {
  mode: BaseTransitionProps['mode']
  persisted: boolean

  beforeEnter(el: HostElement): void

  enter(el: HostElement): void

  leave(el: HostElement, remove: () => void): void

  clone(vnode: VNode): TransitionHooks<HostElement>

  // 可选
  afterLeave?(): void

  delayLeave?(
    el: HostElement,
    earlyRemove: () => void,
    delayedLeave: () => void
  ): void

  delayedLeave?(): void
}

export interface BaseTransitionProps<HostElement = RendererElement> {
  mode?: 'in-out' | 'out-in' | 'default'
  appear?: boolean

  // 如果为真，表示这是一个过渡，实际上并没有插入/删除元素，而是切换了显示/隐藏状态。
  // 注入了过渡钩子，但会被渲染器跳过。相反，一个自定义指令可以通过调用注入的钩子（如v-show）来控制过渡。
  // 注入钩子 (e.g. v-show)
  persisted?: boolean
  // 钩子。在呈现函数&JSX中使用camel-case更容易使用。
  // 在模板中，这些可以写为@before enter=“xxx”，因为 prop 的名称是驼峰化的。
  onBeforeEnter?: (el: HostElement) => void
  onEnter?: (el: HostElement, done: () => void) => void
  onAfterEnter?: (el: HostElement) => void
  onEnterCancelled?: (el: HostElement) => void

  // leave
  onBeforeLeave?: (el: HostElement) => void
  onLeave?: (el: HostElement, done: () => void) => void
  onAfterLeave?: (el: HostElement) => void
  onLeaveCancelled?: (el: HostElement) => void // 仅在持久模式下激发

  // appear
  onBeforeAppear?: (el: HostElement) => void
  onAppear?: (el: HostElement, done: () => void) => void
  onAfterAppear?: (el: HostElement) => void
  onAppearCancelled?: (el: HostElement) => void
}

/**
 * 占位符实际上只处理一种特殊情况。KeepAlive
 * 在KeepAlive处于离开阶段的情况下，我们需要返回一个空内容的KeepAlive占位符，
 * 以避免KeepAlive实例被卸载。
 * */
function emptyPlaceholder(vnode: VNode): VNode | undefined {
  if (isKeepAlive(vnode)) {
    vnode = cloneVNode(vnode)
    vnode.children = null
    return vnode
  }
}

function getKeepAliveChild(vnode: VNode): VNode | undefined {
  return isKeepAlive(vnode)
    ? vnode.children
      ? ((vnode.children as VNodeArrayChildren[0]) as VNode)
      : undefined
    : vnode
}

function getLeavingNodesForType(
  state: TransitionState,
  vnode: VNode
): Record<string, VNode> {
  const { leavingVNodes } = state
  let leavingVNodesCache = leavingVNodes.get(vnode.type)!
  if (!leavingVNodesCache) {
    leavingVNodesCache = Object.create(null)
    leavingVNodes.set(vnode.type, leavingVNodesCache)
  }
  return leavingVNodesCache
}

export function getTransitionRawChildren(
  children: VNode[],
  keepComment: boolean = false
): VNode[] {
  let ret: VNode[] = []
  let keyedFragmentCount = 0
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    // 处理片段 children 案例，例如v-for
    if (child.type === Fragment) {
      if (child.patchFlag & PatchFlags.KEYED_FRAGMENT) keyedFragmentCount++
      ret = ret.concat(
        getTransitionRawChildren(child.children as VNode[], keepComment)
      )
    }
    // 注释占位符应该被跳过，例如v-if等。
    else if (keepComment || child.type !== Comment) {
      ret.push(child)
    }
  }

  // #1126 如果一个过渡子列表包含多个子片段，这些片段将被合并成一个扁平的子数组。
  // 由于每个v-for片段内部可能包含不同的静态绑定，所以我们需要去置顶这些子片段，以强制完整的差异来确保正确的行为。
  if (keyedFragmentCount > 1) {
    for (let i = 0; i < ret.length; i++) {
      ret[i].patchFlag = PatchFlags.BAIL
    }
  }
  return ret
}

const TransitionHookValidator = [Function, Array]
const BaseTransitionImpl = {
  name: `BaseTransition`,
  props: {
    mode: String,
    appear: Boolean,
    persisted: Boolean,
    // enter
    onBeforeEnter: TransitionHookValidator,
    onEnter: TransitionHookValidator,
    onAfterEnter: TransitionHookValidator,
    onEnterCancelled: TransitionHookValidator,
    // leave
    onBeforeLeave: TransitionHookValidator,
    onLeave: TransitionHookValidator,
    onAfterLeave: TransitionHookValidator,
    onLeaveCancelled: TransitionHookValidator,
    // appear
    onBeforeAppear: TransitionHookValidator,
    onAppear: TransitionHookValidator,
    onAfterAppear: TransitionHookValidator,
    onAppearCancelled: TransitionHookValidator
  },
  setup(props: BaseTransitionProps, { slots }: SetupContext) {
    const instance = getCurrentInstance()!
    const state = useTransitionState()

    let prevTransitionKey: any
    return () => {
      const children = slots.default && getTransitionRawChildren(slots.default(), true)
      if (!children || !children.length) {
        return
      }
      // 警告多个elements
      if (__DEV__ && children.length > 1) {
        warn(
          '<transition> can only be used on a single element or component. Use ' +
          '<transition-group> for lists.'
        )
      }

      //  这些prop不需要跟踪反应性，所以使用原始prop可以更好的完善一下。
      const rawProps = toRaw(props)
      const { mode } = rawProps

      // check mode
      if (__DEV__ && mode && !['in-out', 'out-in', 'default'].includes(mode)) {
        warn(`invalid <transition> mode: ${mode}`)
      }

      // 这时的 children 有保证长度为1。
      const child = children[0]
      if (state.isLeaving) {
        return emptyPlaceholder(child)
      }

      // 在<transition><keep-alive/></transition>的情况下，我们需要比较keep-alive子代的类型。
      const innerChild = getKeepAliveChild(child)
      if (!innerChild) {
        return emptyPlaceholder(child)
      }

      const enterHooks = resolveTransitionHooks(
        innerChild,
        rawProps,
        state,
        instance
      )
      setTransitionHooks(innerChild, enterHooks)
      const oldChild = instance.subTree
      const oldInnerChild = oldChild && getKeepAliveChild(oldChild)

      let transitionKeyChanged = false
      const { getTransitionKey } = innerChild.type as any
      if (getTransitionKey) {
        const key = getTransitionKey()
        if (prevTransitionKey === undefined) {
          prevTransitionKey = key
        } else if (key !== prevTransitionKey) {
          prevTransitionKey = key
          transitionKeyChanged = true
        }
      }
      // handle mode
      if (
        oldInnerChild &&
        oldInnerChild.type !== Comment &&
        (!isSameVNodeType(innerChild, oldInnerChild) || transitionKeyChanged)
      ) {
        const leavingHooks = resolveTransitionHooks(
          oldInnerChild,
          rawProps,
          state,
          instance
        )
        // 在动态 transition 的情况下，更新旧树的钩子。
        setTransitionHooks(oldInnerChild, leavingHooks)
        // 在不同的视图之间切换
        if (mode === 'out-in') {
          state.isLeaving = true
          // 离开结束时返回占位符节点和队列更新
          leavingHooks.afterLeave = () => {
            state.isLeaving = false
            instance.update()
          }
          return emptyPlaceholder(child)
        } else if (mode === 'in-out') {
          leavingHooks.delayLeave = (
            el: TransitionElement,
            earlyRemove,
            delayedLeave
          ) => {
            const leavingVNodeCache = getLeavingNodesForType(
              state,
              oldInnerChild
            )
            leavingVNodeCache[String(oldInnerChild.key)] = oldInnerChild
            // 提前删除回调
            el._leaveCb = () => {
              earlyRemove()
              el._leaveCb = undefined
              delete enterHooks.delayedLeave
            }
            enterHooks.delayedLeave = delayedLeave
          }
        }
      }
      return child
    }
  }
}

// export the public type for h/tsx inference
// also to avoid inline import() in generated d.ts files
export const BaseTransition = (BaseTransitionImpl as any) as {
  new(): {
    $props: BaseTransitionProps<any>
  }
}

export function setTransitionHooks(vnode: VNode, hooks: TransitionHooks) {
  if (vnode.shapeFlag & ShapeFlags.COMPONENT && vnode.component) {
    setTransitionHooks(vnode.component.subTree, hooks)
  } else if (__FEATURE_SUSPENSE__ && vnode.shapeFlag & ShapeFlags.SUSPENSE) {
    vnode.ssContent!.transition = hooks.clone(vnode.ssContent!)
    vnode.ssFallback!.transition = hooks.clone(vnode.ssFallback!)
  } else {
    vnode.transition = hooks
  }
}

export type PendingCallback = (cancelled?: boolean) => void

export interface TransitionElement {
  // 在持久模式下（e.g. v-show），同一元素被切换，
  // 所以如果状态被切换，可能需要取消待定的 enter/leave 回调。
  _enterCb?: PendingCallback
  _leaveCb?: PendingCallback
}

// 过渡钩子作为vnode.transition附加到vnode上，并将在渲染器中的适当时机被调用。
export function resolveTransitionHooks(
  vnode: VNode,
  props: BaseTransitionProps<any>,
  state: TransitionState,
  instance: ComponentInternalInstance
): TransitionHooks {
  const {
    appear,
    mode,
    persisted = false,
    onBeforeEnter,
    onEnter,
    onAfterEnter,
    onEnterCancelled,
    onBeforeLeave,
    onLeave,
    onAfterLeave,
    onLeaveCancelled,
    onBeforeAppear,
    onAppear,
    onAfterAppear,
    onAppearCancelled
  } = props
  const key = String(vnode.key)
  const leavingVNodesCache = getLeavingNodesForType(state, vnode)

  const callHook: TransitionHookCaller = (hook, args) => {
    hook && callWithAsyncErrorHandling(
      hook,
      instance,
      ErrorCodes.TRANSITION_HOOK,
      args
    )
  }
  const hooks: TransitionHooks<TransitionElement> = {
    mode,
    persisted,
    beforeEnter(el: TransitionElement) {
      let hook = onBeforeEnter
      if (!state.isMounted) {
        if (appear) {
          hook = onBeforeAppear || onBeforeEnter
        } else {
          return
        }
      }
      // 对于同一个 element(v-show)
      if (el._leaveCb) {
        el._leaveCb(true /* cancelled*/)
      }

      // 对于相同键的切换元素(v-if)
      const leavingVNode = leavingVNodesCache[key]
      if (
        leavingVNode &&
        isSameVNodeType(vnode, leavingVNode) &&
        leavingVNode.el!._leaveCb
      ) {
        // 强制提前移除（未取消）
        leavingVNode.el!._leaveCb()
      }
      callHook(hook, [el])
    },
    enter(el: TransitionElement) {
      let hook = onEnter
      let afterHook = onAfterEnter
      let cancelHook = onEnterCancelled
      if (!state.isMounted) {
        if (appear) {
          hook = onAppear || onEnter
          afterHook = onAfterAppear || onAfterEnter
          cancelHook = onAppearCancelled || onEnterCancelled
        } else {
          return
        }
      }
      let called = false
      const done = (el._enterCb = (cancelled?) => {
        if (called) return
        if (cancelled) {
          callHook(cancelHook, [el])
        } else {
          callHook(afterHook, [el])
        }
        if (hooks.delayedLeave) {
          hooks.delayedLeave()
        }
        el._enterCb = undefined
      })
      if (hook) {
        hook(el, done)
        if (hook.length <= 1) {
          done()
        }
      } else {
        done()
      }
    },
    leave(el: TransitionElement, remove) {
      const key = String(vnode.key)

      if (el._enterCb) {
        el._enterCb(true /*cancelled*/)
      }
      if (state.isUnmounting) {
        return remove()
      }
      callHook(onBeforeLeave, [el])
      let called = false
      const done = (el._leaveCb = (cancelled?) => {
        if (called) return
        called = true
        remove()
        if (cancelled) {
          callHook(onLeaveCancelled, [el])
        } else {
          callHook(onAfterLeave, [el])
        }
        el._leaveCb = undefined
        if (leavingVNodesCache[key] === vnode) {
          delete leavingVNodesCache[key]
        }
      })
      leavingVNodesCache[key] = vnode
      if (onLeave) {
        onLeave(el, done)
        if (onLeave.length <= 1) {
          done()
        }
      } else {
        done()
      }
    },
    clone(vnode: VNode) {
      return resolveTransitionHooks(vnode, props, state, instance)
    }
  }
  return hooks
}
