import {
  cloneVNode,
  ComponentInternalInstance, ConcreteComponent, FunctionalComponent,
  getCurrentInstance, isVNode, onBeforeUnmount, onMounted,
  onUnmounted, onUpdated, RendererElement, RendererNode,
  SetupContext,
  VNode,
  VNodeProps, watch
} from '@vue/runtime-core'
import { currentInstance, LifecycleHooks } from '../component'
import { injectHook } from '../apiLifecycle'
import { invokeArrayFns, isArray, isString, remove } from '@vue/shared'
import { invokeVNodeHook, MoveType, queuePostRenderEffect, RendererInternals } from '../renderer'
import { warn } from '../warning'
import { ShapeFlags } from '../shapeFlags'
import { ComponentRenderContext } from '../componentPublicInstance'
import { setTransitionHooks } from './BaseTransition'

export const isKeepAlive = (vnode: VNode): boolean => (vnode.type as any).__isKeepAlive

function getInnerChild(vnode: VNode) {
  return vnode.shapeFlag & ShapeFlags.SUSPENSE ? vnode.ssContent! : vnode
}

export interface KeepAliveContext extends ComponentRenderContext {
  renderer: RendererInternals
  activate: (
    vnode: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    isSVG: boolean,
    optimized: boolean
  ) => void
  deactivate: (vnode: VNode) => void
}

type CacheKey = string | number | ConcreteComponent
type Cache = Map<CacheKey, VNode>
type Keys = Set<CacheKey>

function resetShapeFlag(vnode: VNode) {
  let shapeFlag = vnode.shapeFlag
  if (shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
    shapeFlag -= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
  }
  if (shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
    shapeFlag -= ShapeFlags.COMPONENT_KEPT_ALIVE
  }
  vnode.shapeFlag = shapeFlag
}

function getName(comp: ConcreteComponent): string | void {
  return (comp as FunctionalComponent).displayName || comp.name
}

function matches(pattern: MatchPattern, name: string): boolean {
  if (isArray(pattern)) {
    return pattern.some((p: string | RegExp) => matches(p, name))
  } else if (isString(pattern)) {
    return pattern.split(',').indexOf(name) > -1
  } else if (pattern.test) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}

const KeepAliveImpl = {
  name: 'KeepAlive',
  // 用于渲染器内部特殊处理的标记。我们没有在渲染器中直接使用KeepAlive的检查，
  // 因为直接导入会防止它被树状摇动。
  __isKeepAlive: true,
  inheritRef: true,
  props: {
    include: [String, RegExp, Array],
    exclude: [String, RegExp, Array],
    max: [String, Number]
  },
  setup(props: KeepAliveProps, { slots }: SetupContext) {
    const cache: Cache = new Map()
    const keys: Keys = new Set()
    let current: VNode | null = null
    const instance = getCurrentInstance()!
    const parentSuspense = instance.suspense

    // KeepAlive通过ctx与实例化的渲染器进行通信，
    // 渲染器在ctx中传递它的内部结构，KeepAlive 实例暴露了 activate/deactivate 的实现。
    // 这样做的目的是为了避免在渲染器中直接导入KeepAlive，以方便树形摇动。
    const sharedContext = instance.ctx as KeepAliveContext
    const {
      renderer: {
        p: patch,
        m: move,
        um: _unmount,
        o: { createElement }
      }
    } = sharedContext
    const storageContainer = createElement('div')
    sharedContext.activate = (vnode, container, anchor, isSVG, optimized) => {
      const instance = vnode.component!
      move(vnode, container, anchor, MoveType.ENTER, parentSuspense)
      // 以防 props 发生变化
      patch(
        instance.vnode,
        vnode,
        container,
        anchor,
        instance,
        parentSuspense,
        isSVG,
        optimized
      )
      queuePostRenderEffect(() => {
        instance.isDeactivated = false
        // TODO: instance.a ?
        if (instance.a) {
          invokeArrayFns(instance.a)
        }
        const vnodeHook = vnode.props && vnode.props.onVnodeMounted
        if (vnodeHook) {
          invokeVNodeHook(vnodeHook, instance.parent, vnode)
        }
      }, parentSuspense)
    }

    sharedContext.deactivate = (vnode: VNode) => {
      const instance = vnode.component!
      move(vnode, storageContainer, null, MoveType.LEAVE, parentSuspense)
      queuePostRenderEffect(() => {
        if (instance.da) {
          invokeArrayFns(instance.da)
        }
        const vnodeHook = vnode.props && vnode.props.onVnodeUnmounted
        if (vnodeHook) {
          invokeVNodeHook(vnodeHook, instance.parent, vnode)
        }
        instance.isDeactivated = true
      }, parentSuspense)
    }

    function unmount(vnode: VNode) {
      // 重置shapeFlag，使其可以正确地卸载。
      resetShapeFlag(vnode)
      _unmount(vnode, instance, parentSuspense)
    }

    function pruneCache(filter?: (name: string) => boolean) {
      cache.forEach((vnode, key) => {
        const name = getName(vnode.type as ConcreteComponent)
        if (name && (!filter || !filter(name))) {
          pruneCacheEntry(key)
        }
      })
    }

    function pruneCacheEntry(key: CacheKey) {
      const cached = cache.get(key) as VNode
      if (!current || cached.type !== current.type) {
        unmount(cached)
      } else if (current) {
        // 当前活动的实例不应再保持活跃。
        // 我们现在不能卸载它，但以后可能会，所以现在重新设置它的标志。
        resetShapeFlag(current)
      }
      cache.delete(key)
      keys.delete(key)
    }

    // 在include/exclude prop 变化时修剪缓存。
    watch(
      () => [props.include, props.exclude],
      ([include, exclude]) => {
        include && pruneCache(name => matches(include, name))
        exclude && pruneCache(name => !matches(exclude, name))
      },
      // 在 "current "被更新后，修剪后渲染。
      { flush: 'post' }
    )

    // 渲染后缓存子树
    let pendingCacheKey: CacheKey | null = null
    const cacheSubtree = () => {
      // fix #1621, the pendingCacheKey could be 0
      if (pendingCacheKey != null) {
        cache.set(pendingCacheKey, getInnerChild(instance.subTree))
      }
    }
    onMounted(cacheSubtree)
    onUpdated(cacheSubtree)
    onBeforeUnmount(() => {
      cache.forEach(cached => {
        const { subtree, suspense } = instanse
        const vnode = getInnerChild(subtree)

        if (cached.type === vnode.type) {
          // 当前实例将被卸载，作为 keep-alive 卸载的一部分。
          resetShapeFlag(vnode)
          // 但在这里调用其停用的钩子
          const da = vnode.component!.da
          da && queuePostRenderEffect(da, suspense)
          return
        }
        unmount(cached)
      })
    })

    return () => {
      pendingCacheKey = null
      if (!slots.default) {
        return null
      }

      const children = slots.default()
      const rawVNode = children[0]
      if (children.length > 1) {
        if (__DEV__) {
          warn(`KeepAlive should contain exactly one component child.`)
        }
        current = null
        return children
      } else if (
        !isVNode(rawVNode) ||
        (!(rawVNode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) &&
          !(rawVNode.shapeFlag & ShapeFlags.SUSPENSE)
        )
      ) {
        current = null
        return rawVNode
      }
      let vnode = getInnerChild(rawVNode)
      const comp = vnode.type as ConcreteComponent
      const name = getName(comp)
      const { include, exclude, max } = props

      if (
        (include && (!name || !matches(include, name))) ||
        (exclude && name && matches(exclude, name))
      ) {
        current = vnode
        return rawVNode
      }
      const key = vnode.key == null ? comp : vnode.key
      const cachedVNode = cache.get(key)

      // 克隆vnode，如果它被重复使用，因为我们要对它进行变更。
      if (vnode.el) {
        vnode = cloneVNode(vnode)
        if (rawVNode.shapeFlag & ShapeFlags.SUSPENSE) {
          rawVNode.ssContent = vnode
        }
      }
      // #1513由于attr fallthrough或scopeId的原因，返回的vnode有可能被克隆，
      // 所以这里的vnode可能不是最终挂载的vnode。
      // 我们没有直接缓存，而是将待定的key存储起来，并将`instance.subTree`
      // （归一化的vnode）缓存在 beforeMount/beforeUpdate 钩子中。
      pendingCacheKey = key

      if (cachedVNode) {
        // 复制已装载状态
        vnode.el = cachedVNode.el
        vnode.component = cachedVNode.component
        if (vnode.transition) {
          // 递归更新子树上的转换挂钩
          setTransitionHooks(vnode, vnode.transition)
        }

        // 避免将vnode安装为新的
        vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE
        // 确保 key 是最新
        keys.delete(key)
        keys.add(key)
      } else {
        keys.add(key)
        // 删除最早的条目
        if (max && keys.size > parseInt(max as string, 10)) {
          pruneCacheEntry(keys.values().next().value)
        }
      }
      // 避免 vnode 被卸载
      vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
      current = vnode
      return rawVNode

    }
  }
}
type MatchPattern = string | RegExp | string[] | RegExp[]

export interface KeepAliveProps {
  include?: MatchPattern
  exclude?: MatchPattern
  max?: number | string
}

// export the public type for h/tsx inference
// also to avoid inline import() in generated d.ts files
export const KeepAlive = (KeepAliveImpl as any) as {
  __isKeepAlive: true
  new(): {
    $props: VNodeProps & KeepAliveProps
  }
}


function injectToKeepAliveRoot(
  hook: Function & { __weh?: Function },
  type: LifecycleHooks,
  target: ComponentInternalInstance,
  keepAliveRoot: ComponentInternalInstance
) {
  // injectHook 封装了原始的错误处理，所以一定要删除封装的版本。
  const injected = injectHook(type, hook, keepAliveRoot, true/* prepend */)
  onUnmounted(() => {
    remove(keepAliveRoot[type]!, injected)
  }, target)
}

function registerKeepAliveHook(
  hook: Function & { __wdc?: Function },
  type: LifecycleHooks,
  target: ComponentInternalInstance | null = currentInstance
) {
  // 缓存注入的钩子的停用分支检查包装器，这样同一个钩子就可以被调度器正确地重复检查。"__wdc "代表 "停用检查"。
  const wrappedHook =
    hook.__wdc ||
    (hook.__wdc = () => {
      // 只有当目标实例不在停用的分支中时，才会启动钩子。
      let current: ComponentInternalInstance | null = target
      while (current) {
        if (current.isDeactivated) {
          return
        }
        current = current.parent
      }
      hook()
    })
  injectHook(type, wrappedHook, target)
  // 除了在目标实例上注册外，我们还沿着父链向上走，在所有保持活力的根的祖先实例上注册。
  // 这就避免了在调用这些钩子时需要走遍整个组件树，更重要的是，避免了在数组中跟踪子组件。
  if (target) {
    let current = target.parent
    while (current && current.parent) {
      if (isKeepAlive(current.parent.vnode)) {
        injectToKeepAliveRoot(wrappedHook, type, target, current)
      }
      current = current.parent
    }
  }

}

// keepalive hook
export function onActivated(
  hook: Function,
  target?: ComponentInternalInstance | null
) {
  registerKeepAliveHook(hook, LifecycleHooks.ACTIVATED, target)
}

// keepalive remove hook
export function onDeactivated(
  hook: Function,
  target?: ComponentInternalInstance | null
) {
  registerKeepAliveHook(hook, LifecycleHooks.DEACTIVATED, target)
}
