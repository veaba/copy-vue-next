/**
 * vue runtime-core 和合照~方便记忆学习，
 * */

import {
  EffectFlags,
  getCurrentScope,
  isProxy,
  isReactive,
  isRef,
  markRaw,
  pauseTracking,
  proxyRefs,
  reactive,
  ReactiveEffect,
  ReactiveFlags,
  ReactiveMarker,
  ref,
  Ref,
  resetTracking,
  shallowReactive,
  shallowReadonly,
  ShallowRef,
  toRaw,
  traverse,
  trigger,
  TriggerOpTypes,
  WatchEffect,
  WatchErrorCodes,
  WatchHandle,
  WatchOptions as BaseWatchOptions,
  WatchSource,
  TrackOpTypes,
  track,
  computed,
  WatchOptions
} from '@vue/reactivity'
import { watch as baseWatch } from '@vue/reactivity'
import { camelize, capitalize, EMPTY_ARR, EMPTY_OBJ, extend, getEscapedCssVarName, getGlobalThis, hasOwn, IfAny, includeBooleanAttr, isArray, isBooleanAttr, isBuiltInDirective, isGloballyAllowed, } from '@vue/shared'
import { isFunction, IsKeyValues, isKnownHtmlAttr, isKnownSvgAttr, isModelListener, isObject, isOn, isPlainObject, isPromise, isString, makeMap, NO, NOOP, normalizeCssVarValue, } from '@vue/shared'
import { NormalizedStyle, PatchFlags, remove, ShapeFlags, SlotFlags, toHandlerKey, toNumber, toRawType } from '@vue/shared'
import { assertNumber, warn } from './warning'
import { CompilerOptions, ComponentInjectOptions } from '@vue/compile-core'
import { LifecycleHooks, ErrorCodes, TeleportMoveTypes, MoveType, DeprecationTypes, SchedulerJobFlags, DOMNodeTypes, MismatchTypes, AccessTypes, DevtoolsHooks, BooleanFlags, OptionTypes } from './enum'
import { compatModelEventPrefix, COMPONENTS, DIRECTIVES, FILTERS, } from './define'
import { Fragment, isHmrUpdating, leaveCbKey, NULL_DYNAMIC_COMPONENT, ssrContextKey, Static, TeleportEndKey, Text } from './define'
import type { App, AppConfig, AppContext, AsyncComponentOptions, ClassComponent, ComponentInternalInstance, ComponentOptionsBase, ComponentRenderContext, } from './interface'
import type { DevtoolsHook, DirectiveBinding, FunctionalComponent, HydrationRenderer, KeepAliveContext, LegacyDirective, LegacyVNodeProps, ObjectDirective, PropOptions, } from './interface'
import type { Renderer, RendererElement, RendererInternals, RendererNode, RendererOptions, SchedulerJob, SuspenseBoundary, SuspenseProps, TeleportProps, TeleportTargetElement, TransitionHooks, VNode, WatchAPIOptions } from './interface'
import type { AssetTypes, AsyncComponentLoader, CompatConfig, CompatVue, Component, ComponentObjectPropsOptions, ComponentOptions, ComponentOptionsMixin, Constructor, HTMLElementEventHandler, RawChildren, RawProps, } from './type'
import type { ComponentPropsOptions, ComponentProvideOptions, ComponentPublicInstance, ComponentTypeEmits, ComputedOptions, ConcreteComponent, ContextualRenderFn, CreateAppFunction, } from './type'
import type { CreateComponentPublicInstanceWithMixins, Data, DebuggerHook, DefineComponent, DefineSetupFnComponent, DevtoolsComponentHook, Directive, DirectiveHook, ElementNamespace, EmitsOptions, } from './type'
import type { ErrorCapturedHook, ErrorTypes, ExtractDefaultPropTypes, ExtractPropTypes, InjectionKey, InternalRenderFunction, InternalSlots, LifecycleHook, MergedComponentOptions, MethodOptions, MountComponentFn, } from './type'
import type { NormalizedProps, NormalizedPropsOptions, ObjectEmitsOptions, ObjectWatchOptionItem, OptionMergeFunction, Prop, PublicPropertiesMap, PublicProps, RawSlots, RenderFunction, RootHydrateFunction, RootRenderFunction, } from './type'
import type { SchedulerJobs, SetupContext, SetupRenderEffectFn, Slot, Slots, SlotsType, TeleportVNode, TypeEmitsToOptions, VNodeArrayChildren, VNodeChild, VNodeHook, VNodeNormalizedChildren, } from './type'
import type { VNodeNormalizedRef, VNodeNormalizedRefAtom, VNodeProps, VNodeRef, VNodeTypes, WatchCallback } from './type'
import type { AssertionResult, CompileFunction, ComponentWatchOptionItem, ComponentWatchOptions, CountMap, CreateHook, DeprecationData, DevtoolsPerformanceHook, HMRComponent, LegacyAsyncComponent, LegacyAsyncReturnValue, LegacyVNodeChildren, MountChildrenFn, MoveFn, NextFn, NormalizedProp, ObjectInjectOptions, PatchBlockChildrenFn, PatchChildrenFn, PatchFn, Plugin, ProcessTextOrCommentFn, PropConstructor, RemoveFn, SetRootFn, ToResolvedProps, UnmountChildrenFn, UnmountFn } from './type'
import type { DirectiveArguments } from './type'


/**** define ***/
export const version: string = __VERSION__
const RECURSION_LIMIT = 100

// exported only for test
let singletonApp: App
let installWithProxy: (i: ComponentInternalInstance) => void
let compile: CompileFunction | undefined
let shouldCacheAccess = true
let currentRenderingInstance: ComponentInternalInstance | null = null
let isInSSRComponentSetup = false
let hasWarned = false
let activeEffectScope: EffectScope | undefined

let currentInstance: ComponentInternalInstance | null = null

export let currentScopeId: string | null = null
// test only
let warningEnabled = true


let buffer: { event: string; args: any[] }[] = []
let devtoolsNotInstalled = false
let accessedAttrs: boolean = false
const patched = new WeakSet<object>()
const seenConfigObjects = /*@__PURE__*/ new WeakSet<CompatConfig>()
const warnedInvalidKeys: Record<string, boolean> = {}

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
]

export function markAttrsAccessed(): void {
  accessedAttrs = true
}
const instanceWarned: Record<string, true> = Object.create(null)
const warnCount: Record<string, number> = Object.create(null)

/**
 * @internal Used to identify the current app when using `inject()` within
 * `app.runWithContext()`.
 */
export let currentApp: App<unknown> | null = null

const allowMismatchAttr = 'data-allow-mismatch'
let hasLoggedMismatchError = false
let supported: boolean
let perf: Performance
let isCopyingConfig = false
let singletonCtor: CompatVue
const styleCommentRE = /\/\*[^]*?\*\//g
const listDelimiterRE = /;(?![^(]*\))/g
const propertyDelimiterRE = /:([^]+)/
const hyphenateRE = /\B([A-Z])/g
const classifyRE = /(?:^|[-_])(\w)/g
let vnodeArgsTransformer:
  | ((
    args: Parameters<typeof _createVNode>,
    instance: ComponentInternalInstance | null,
  ) => Parameters<typeof _createVNode>)
  | undefined

let setInSSRSetupState: (state: boolean) => void

export const blockStack: VNode['dynamicChildren'][] = []
export let currentBlock: VNode['dynamicChildren'] = null
const internalObjectProto = {}
let activePostFlushCbs: SchedulerJob[] | null = null
let postFlushIndex = 0
let uid = 0
// incrementing unique id for every pending branch
let suspenseId = 0
const pendingPostFlushCbs: SchedulerJob[] = []
let currentFlushPromise: Promise<void> | null = null


const resolvedPromise = /*@__PURE__*/ Promise.resolve() as Promise<any>
let flushIndex = -1
const queue: SchedulerJob[] = []
const stack: VNode[] = []
export let devtools: DevtoolsHook

const normalizedFunctionalComponentMap = new WeakMap<
  ComponentOptions,
  FunctionalComponent
>()

const warnedTypes = new WeakSet()
export const knownTemplateRefs: WeakSet<ShallowRef> = new WeakSet()
const mixinPropsCache = new WeakMap<ConcreteComponent, NormalizedPropsOptions>()

export const globalCompatConfig: CompatConfig = {
  MODE: 2,
}

// Whether we should be tracking dynamic child nodes inside a block.
// Only tracks when this value is > 0
// We are not using a simple boolean because this value may need to be
// incremented/decremented by nested usage of v-once (see below)
export let isBlockTreeEnabled = 1



// TODO rename
const map: Map<
  string,
  {
    // the initial component definition is recorded on import - this allows us
    // to apply hot updates to the component even when there are no actively
    // rendered instance.
    initialDef: ComponentOptions
    instances: Set<ComponentInternalInstance>
  }
> = new Map()

const MismatchTypeString: Record<MismatchTypes, string> = {
  [MismatchTypes.TEXT]: 'text',
  [MismatchTypes.CHILDREN]: 'children',
  [MismatchTypes.CLASS]: 'class',
  [MismatchTypes.STYLE]: 'style',
  [MismatchTypes.ATTRIBUTE]: 'attribute',
} as const


export const ErrorTypeStrings: Record<ErrorTypes, string> = {
  [LifecycleHooks.SERVER_PREFETCH]: 'serverPrefetch hook',
  [LifecycleHooks.BEFORE_CREATE]: 'beforeCreate hook',
  [LifecycleHooks.CREATED]: 'created hook',
  [LifecycleHooks.BEFORE_MOUNT]: 'beforeMount hook',
  [LifecycleHooks.MOUNTED]: 'mounted hook',
  [LifecycleHooks.BEFORE_UPDATE]: 'beforeUpdate hook',
  [LifecycleHooks.UPDATED]: 'updated',
  [LifecycleHooks.BEFORE_UNMOUNT]: 'beforeUnmount hook',
  [LifecycleHooks.UNMOUNTED]: 'unmounted hook',
  [LifecycleHooks.ACTIVATED]: 'activated hook',
  [LifecycleHooks.DEACTIVATED]: 'deactivated hook',
  [LifecycleHooks.ERROR_CAPTURED]: 'errorCaptured hook',
  [LifecycleHooks.RENDER_TRACKED]: 'renderTracked hook',
  [LifecycleHooks.RENDER_TRIGGERED]: 'renderTriggered hook',
  [ErrorCodes.SETUP_FUNCTION]: 'setup function',
  [ErrorCodes.RENDER_FUNCTION]: 'render function',
  [WatchErrorCodes.WATCH_GETTER]: 'watcher getter',
  [WatchErrorCodes.WATCH_CALLBACK]: 'watcher callback',
  [WatchErrorCodes.WATCH_CLEANUP]: 'watcher cleanup function',
  [ErrorCodes.NATIVE_EVENT_HANDLER]: 'native event handler',
  [ErrorCodes.COMPONENT_EVENT_HANDLER]: 'component event handler',
  [ErrorCodes.VNODE_HOOK]: 'vnode hook',
  [ErrorCodes.DIRECTIVE_HOOK]: 'directive hook',
  [ErrorCodes.TRANSITION_HOOK]: 'transition hook',
  [ErrorCodes.APP_ERROR_HANDLER]: 'app errorHandler',
  [ErrorCodes.APP_WARN_HANDLER]: 'app warnHandler',
  [ErrorCodes.FUNCTION_REF]: 'ref function',
  [ErrorCodes.ASYNC_COMPONENT_LOADER]: 'async component loader',
  [ErrorCodes.SCHEDULER]: 'scheduler flush',
  [ErrorCodes.COMPONENT_UPDATE]: 'component update',
  [ErrorCodes.APP_UNMOUNT_CLEANUP]: 'app unmount cleanup function',
}


export const hmrDirtyComponents: Map<
  ConcreteComponent,
  Set<ComponentInternalInstance>
> = new Map<ConcreteComponent, Set<ComponentInternalInstance>>()
const normalizeKey = ({ key }: VNodeProps): VNode['key'] =>
  key != null ? key : null
const legacyDirectiveHookMap: Partial<
  Record<
    keyof ObjectDirective,
    keyof LegacyDirective | (keyof LegacyDirective)[]
  >
> = {
  beforeMount: 'bind',
  mounted: 'inserted',
  updated: ['update', 'componentUpdated'],
  unmounted: 'unbind',
}


const skipLegacyRootLevelProps = /*@__PURE__*/ makeMap(
  'staticStyle,staticClass,directives,model,hook',
)

/**** type ***/



/**** interface ***/


/**** class  ***/
export class EffectScope {
  /**
   * @internal
   */
  private _active = true
  /**
   * @internal track `on` calls, allow `on` call multiple times
   */
  private _on = 0
  /**
   * @internal
   */
  effects: ReactiveEffect[] = []
  /**
   * @internal
   */
  cleanups: (() => void)[] = []

  private _isPaused = false

  /**
   * only assigned by undetached scope
   * @internal
   */
  parent: EffectScope | undefined
  /**
   * record undetached scopes
   * @internal
   */
  scopes: EffectScope[] | undefined
  /**
   * track a child scope's index in its parent's scopes array for optimized
   * removal
   * @internal
   */
  private index: number | undefined

  constructor(public detached = false) {
    this.parent = activeEffectScope
    if (!detached && activeEffectScope) {
      this.index =
        (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
          this,
        ) - 1
    }
  }

  get active(): boolean {
    return this._active
  }

  pause(): void {
    if (this._active) {
      this._isPaused = true
      let i, l
      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].pause()
        }
      }
      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].pause()
      }
    }
  }

  /**
   * Resumes the effect scope, including all child scopes and effects.
   */
  resume(): void {
    if (this._active) {
      if (this._isPaused) {
        this._isPaused = false
        let i, l
        if (this.scopes) {
          for (i = 0, l = this.scopes.length; i < l; i++) {
            this.scopes[i].resume()
          }
        }
        for (i = 0, l = this.effects.length; i < l; i++) {
          this.effects[i].resume()
        }
      }
    }
  }

  run<T>(fn: () => T): T | undefined {
    if (this._active) {
      const currentEffectScope = activeEffectScope
      try {
        activeEffectScope = this
        return fn()
      } finally {
        activeEffectScope = currentEffectScope
      }
    } else if (__DEV__) {
      warn(`cannot run an inactive effect scope.`)
    }
  }

  prevScope: EffectScope | undefined
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on(): void {
    if (++this._on === 1) {
      this.prevScope = activeEffectScope
      activeEffectScope = this
    }
  }

  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off(): void {
    if (this._on > 0 && --this._on === 0) {
      activeEffectScope = this.prevScope
      this.prevScope = undefined
    }
  }

  stop(fromParent?: boolean): void {
    if (this._active) {
      this._active = false
      let i, l
      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].stop()
      }
      this.effects.length = 0

      for (i = 0, l = this.cleanups.length; i < l; i++) {
        this.cleanups[i]()
      }
      this.cleanups.length = 0

      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].stop(true)
        }
        this.scopes.length = 0
      }

      // nested scope, dereference from parent to avoid memory leaks
      if (!this.detached && this.parent && !fromParent) {
        // optimized O(1) removal
        const last = this.parent.scopes!.pop()
        if (last && last !== this) {
          this.parent.scopes![this.index!] = last
          last.index = this.index!
        }
      }
      this.parent = undefined
    }
  }
}

const hasSetupBinding = (state: Data, key: string) =>
  state !== EMPTY_OBJ && !state.__isScriptSetup && hasOwn(state, key)

export const isReservedPrefix = (key: string): key is '_' | '$' =>
  key === '_' || key === '$'

/**** define object ***/

const attrsProxyHandlers = __DEV__
  ? {
    get(target: Data, key: string) {
      markAttrsAccessed()
      track(target, TrackOpTypes.GET, '')
      return target[key]
    },
    set() {
      warn(`setupContext.attrs is readonly.`)
      return false
    },
    deleteProperty() {
      warn(`setupContext.attrs is readonly.`)
      return false
    },
  }
  : {
    get(target: Data, key: string) {
      track(target, TrackOpTypes.GET, '')
      return target[key]
    },
  }


export const PublicInstanceProxyHandlers: ProxyHandler<any> = {
  get({ _: instance }: ComponentRenderContext, key: string) {
    if (key === ReactiveFlags.SKIP) {
      return true
    }

    const { ctx, setupState, data, props, accessCache, type, appContext } =
      instance

    // for internal formatters to know that this is a Vue instance
    if (__DEV__ && key === '__isVue') {
      return true
    }

    // data / props / ctx
    // This getter gets called for every property access on the render context
    // during render and is a major hotspot. The most expensive part of this
    // is the multiple hasOwn() calls. It's much faster to do a simple property
    // access on a plain object, so we use an accessCache object (with null
    // prototype) to memoize what access type a key corresponds to.
    let normalizedProps
    if (key[0] !== '$') {
      const n = accessCache![key]
      if (n !== undefined) {
        switch (n) {
          case AccessTypes.SETUP:
            return setupState[key]
          case AccessTypes.DATA:
            return data[key]
          case AccessTypes.CONTEXT:
            return ctx[key]
          case AccessTypes.PROPS:
            return props![key]
          // default: just fallthrough
        }
      } else if (hasSetupBinding(setupState, key)) {
        accessCache![key] = AccessTypes.SETUP
        return setupState[key]
      } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
        accessCache![key] = AccessTypes.DATA
        return data[key]
      } else if (
        // only cache other properties when instance has declared (thus stable)
        // props
        (normalizedProps = instance.propsOptions[0]) &&
        hasOwn(normalizedProps, key)
      ) {
        accessCache![key] = AccessTypes.PROPS
        return props![key]
      } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
        accessCache![key] = AccessTypes.CONTEXT
        return ctx[key]
      } else if (!__FEATURE_OPTIONS_API__ || shouldCacheAccess) {
        accessCache![key] = AccessTypes.OTHER
      }
    }

    const publicGetter = publicPropertiesMap[key]
    let cssModule, globalProperties
    // public $xxx properties
    if (publicGetter) {
      if (key === '$attrs') {
        track(instance.attrs, TrackOpTypes.GET, '')
        __DEV__ && markAttrsAccessed()
      } else if (__DEV__ && key === '$slots') {
        // for HMR only
        track(instance, TrackOpTypes.GET, key)
      }
      return publicGetter(instance)
    } else if (
      // css module (injected by vue-loader)
      (cssModule = type.__cssModules) &&
      (cssModule = cssModule[key])
    ) {
      return cssModule
    } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
      // user may set custom properties to `this` that start with `$`
      accessCache![key] = AccessTypes.CONTEXT
      return ctx[key]
    } else if (
      // global properties
      ((globalProperties = appContext.config.globalProperties),
        hasOwn(globalProperties, key))
    ) {
      if (__COMPAT__) {
        const desc = Object.getOwnPropertyDescriptor(globalProperties, key)!
        if (desc.get) {
          return desc.get.call(instance.proxy)
        } else {
          const val = globalProperties[key]
          return isFunction(val) ? extend(val.bind(instance.proxy), val) : val
        }
      } else {
        return globalProperties[key]
      }
    } else if (
      __DEV__ &&
      currentRenderingInstance &&
      (!isString(key) ||
        // #1091 avoid internal isRef/isVNode checks on component instance leading
        // to infinite warning loop
        key.indexOf('__v') !== 0)
    ) {
      if (data !== EMPTY_OBJ && isReservedPrefix(key[0]) && hasOwn(data, key)) {
        warn(
          `Property ${JSON.stringify(
            key,
          )} must be accessed via $data because it starts with a reserved ` +
          `character ("$" or "_") and is not proxied on the render context.`,
        )
      } else if (instance === currentRenderingInstance) {
        warn(
          `Property ${JSON.stringify(key)} was accessed during render ` +
          `but is not defined on instance.`,
        )
      }
    }
  },

  set(
    { _: instance }: ComponentRenderContext,
    key: string,
    value: any,
  ): boolean {
    const { data, setupState, ctx } = instance
    if (hasSetupBinding(setupState, key)) {
      setupState[key] = value
      return true
    } else if (
      __DEV__ &&
      setupState.__isScriptSetup &&
      hasOwn(setupState, key)
    ) {
      warn(`Cannot mutate <script setup> binding "${key}" from Options API.`)
      return false
    } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
      data[key] = value
      return true
    } else if (hasOwn(instance.props, key)) {
      __DEV__ && warn(`Attempting to mutate prop "${key}". Props are readonly.`)
      return false
    }
    if (key[0] === '$' && key.slice(1) in instance) {
      __DEV__ &&
        warn(
          `Attempting to mutate public property "${key}". ` +
          `Properties starting with $ are reserved and readonly.`,
        )
      return false
    } else {
      if (__DEV__ && key in instance.appContext.config.globalProperties) {
        Object.defineProperty(ctx, key, {
          enumerable: true,
          configurable: true,
          value,
        })
      } else {
        ctx[key] = value
      }
    }
    return true
  },

  has(
    {
      _: { data, setupState, accessCache, ctx, appContext, propsOptions, type },
    }: ComponentRenderContext,
    key: string,
  ) {
    let normalizedProps, cssModules
    return !!(
      accessCache![key] ||
      (data !== EMPTY_OBJ && key[0] !== '$' && hasOwn(data, key)) ||
      hasSetupBinding(setupState, key) ||
      ((normalizedProps = propsOptions[0]) && hasOwn(normalizedProps, key)) ||
      hasOwn(ctx, key) ||
      hasOwn(publicPropertiesMap, key) ||
      hasOwn(appContext.config.globalProperties, key) ||
      ((cssModules = type.__cssModules) && cssModules[key])
    )
  },

  defineProperty(
    target: ComponentRenderContext,
    key: string,
    descriptor: PropertyDescriptor,
  ) {
    if (descriptor.get != null) {
      // invalidate key cache of a getter based property #5417
      target._.accessCache![key] = 0
    } else if (hasOwn(descriptor, 'value')) {
      this.set!(target, key, descriptor.value, null)
    }
    return Reflect.defineProperty(target, key, descriptor)
  },
}

function hydrateTeleport(
  node: Node,
  vnode: TeleportVNode,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  slotScopeIds: string[] | null,
  optimized: boolean,
  {
    o: { nextSibling, parentNode, querySelector, insert, createText },
  }: RendererInternals<Node, Element>,
  hydrateChildren: (
    node: Node | null,
    vnode: VNode,
    container: Element,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    slotScopeIds: string[] | null,
    optimized: boolean,
  ) => Node | null,
): Node | null {
  const target = (vnode.target = resolveTarget<Element>(
    vnode.props,
    querySelector,
  ))
  if (target) {
    const disabled = isTeleportDisabled(vnode.props)
    // if multiple teleports rendered to the same target element, we need to
    // pick up from where the last teleport finished instead of the first node
    const targetNode =
      (target as TeleportTargetElement)._lpa || target.firstChild
    if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      if (disabled) {
        vnode.anchor = hydrateChildren(
          nextSibling(node),
          vnode,
          parentNode(node)!,
          parentComponent,
          parentSuspense,
          slotScopeIds,
          optimized,
        )
        vnode.targetStart = targetNode
        vnode.targetAnchor = targetNode && nextSibling(targetNode)
      } else {
        vnode.anchor = nextSibling(node)

        // lookahead until we find the target anchor
        // we cannot rely on return value of hydrateChildren() because there
        // could be nested teleports
        let targetAnchor = targetNode
        while (targetAnchor) {
          if (targetAnchor && targetAnchor.nodeType === 8) {
            if ((targetAnchor as Comment).data === 'teleport start anchor') {
              vnode.targetStart = targetAnchor
            } else if ((targetAnchor as Comment).data === 'teleport anchor') {
              vnode.targetAnchor = targetAnchor
                ; (target as TeleportTargetElement)._lpa =
                  vnode.targetAnchor && nextSibling(vnode.targetAnchor as Node)
              break
            }
          }
          targetAnchor = nextSibling(targetAnchor)
        }

        // #11400 if the HTML corresponding to Teleport is not embedded in the
        // correct position on the final page during SSR. the targetAnchor will
        // always be null, we need to manually add targetAnchor to ensure
        // Teleport it can properly unmount or move
        if (!vnode.targetAnchor) {
          prepareAnchor(target, vnode, createText, insert)
        }

        hydrateChildren(
          targetNode && nextSibling(targetNode),
          vnode,
          target,
          parentComponent,
          parentSuspense,
          slotScopeIds,
          optimized,
        )
      }
    }
    updateCssVars(vnode, disabled)
  }
  return vnode.anchor && nextSibling(vnode.anchor as Node)
}


function moveTeleport(
  vnode: VNode,
  container: RendererElement,
  parentAnchor: RendererNode | null,
  { o: { insert }, m: move }: RendererInternals,
  moveType: TeleportMoveTypes = TeleportMoveTypes.REORDER,
): void {
  // move target anchor if this is a target change.
  if (moveType === TeleportMoveTypes.TARGET_CHANGE) {
    insert(vnode.targetAnchor!, container, parentAnchor)
  }
  const { el, anchor, shapeFlag, children, props } = vnode
  const isReorder = moveType === TeleportMoveTypes.REORDER
  // move main view anchor if this is a re-order.
  if (isReorder) {
    insert(el!, container, parentAnchor)
  }
  // if this is a re-order and teleport is enabled (content is in target)
  // do not move children. So the opposite is: only move children if this
  // is not a reorder, or the teleport is disabled
  if (!isReorder || isTeleportDisabled(props)) {
    // Teleport has either Array children or no children.
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      for (let i = 0; i < (children as VNode[]).length; i++) {
        move(
          (children as VNode[])[i],
          container,
          parentAnchor,
          MoveType.REORDER,
        )
      }
    }
  }
  // move main view anchor if this is a re-order.
  if (isReorder) {
    insert(anchor!, container, parentAnchor)
  }
}


function prepareAnchor(
  target: RendererElement | null,
  vnode: TeleportVNode,
  createText: RendererOptions['createText'],
  insert: RendererOptions['insert'],
) {
  const targetStart = (vnode.targetStart = createText(''))
  const targetAnchor = (vnode.targetAnchor = createText(''))

  // attach a special property, so we can skip teleported content in
  // renderer's nextSibling search
  targetStart[TeleportEndKey] = targetAnchor

  if (target) {
    insert(targetStart, target)
    insert(targetAnchor, target)
  }

  return targetAnchor
}

export const TeleportImpl = {
  name: 'Teleport',
  __isTeleport: true,
  process(
    n1: TeleportVNode | null,
    n2: TeleportVNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    namespace: ElementNamespace,
    slotScopeIds: string[] | null,
    optimized: boolean,
    internals: RendererInternals,
  ): void {
    const {
      mc: mountChildren,
      pc: patchChildren,
      pbc: patchBlockChildren,
      o: { insert, querySelector, createText, createComment },
    } = internals

    const disabled = isTeleportDisabled(n2.props)
    let { shapeFlag, children, dynamicChildren } = n2

    // #3302
    // HMR updated, force full diff
    if (__DEV__ && isHmrUpdating) {
      optimized = false
      dynamicChildren = null
    }

    if (n1 == null) {
      // insert anchors in the main view
      const placeholder = (n2.el = __DEV__
        ? createComment('teleport start')
        : createText(''))
      const mainAnchor = (n2.anchor = __DEV__
        ? createComment('teleport end')
        : createText(''))
      insert(placeholder, container, anchor)
      insert(mainAnchor, container, anchor)

      const mount = (container: RendererElement, anchor: RendererNode) => {
        // Teleport *always* has Array children. This is enforced in both the
        // compiler and vnode children normalization.
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          if (parentComponent && parentComponent.isCE) {
            parentComponent.ce!._teleportTarget = container
          }
          mountChildren(
            children as VNodeArrayChildren,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized,
          )
        }
      }

      const mountToTarget = () => {
        const target = (n2.target = resolveTarget(n2.props, querySelector))
        const targetAnchor = prepareAnchor(target, n2, createText, insert)
        if (target) {
          // #2652 we could be teleporting from a non-SVG tree into an SVG tree
          if (namespace !== 'svg' && isTargetSVG(target)) {
            namespace = 'svg'
          } else if (namespace !== 'mathml' && isTargetMathML(target)) {
            namespace = 'mathml'
          }
          if (!disabled) {
            mount(target, targetAnchor)
            updateCssVars(n2, false)
          }
        } else if (__DEV__ && !disabled) {
          warn(
            'Invalid Teleport target on mount:',
            target,
            `(${typeof target})`,
          )
        }
      }

      if (disabled) {
        mount(container, mainAnchor)
        updateCssVars(n2, true)
      }

      if (isTeleportDeferred(n2.props)) {
        n2.el!.__isMounted = false
        queuePostRenderEffect(() => {
          mountToTarget()
          delete n2.el!.__isMounted
        }, parentSuspense)
      } else {
        mountToTarget()
      }
    } else {
      if (isTeleportDeferred(n2.props) && n1.el!.__isMounted === false) {
        queuePostRenderEffect(() => {
          TeleportImpl.process(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized,
            internals,
          )
        }, parentSuspense)
        return
      }
      // update content
      n2.el = n1.el
      n2.targetStart = n1.targetStart
      const mainAnchor = (n2.anchor = n1.anchor)!
      const target = (n2.target = n1.target)!
      const targetAnchor = (n2.targetAnchor = n1.targetAnchor)!
      const wasDisabled = isTeleportDisabled(n1.props)
      const currentContainer = wasDisabled ? container : target
      const currentAnchor = wasDisabled ? mainAnchor : targetAnchor

      if (namespace === 'svg' || isTargetSVG(target)) {
        namespace = 'svg'
      } else if (namespace === 'mathml' || isTargetMathML(target)) {
        namespace = 'mathml'
      }

      if (dynamicChildren) {
        // fast path when the teleport happens to be a block root
        patchBlockChildren(
          n1.dynamicChildren!,
          dynamicChildren,
          currentContainer,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
        )
        // even in block tree mode we need to make sure all root-level nodes
        // in the teleport inherit previous DOM references so that they can
        // be moved in future patches.
        // in dev mode, deep traversal is necessary for HMR
        traverseStaticChildren(n1, n2, !__DEV__)
      } else if (!optimized) {
        patchChildren(
          n1,
          n2,
          currentContainer,
          currentAnchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          false,
        )
      }

      if (disabled) {
        if (!wasDisabled) {
          // enabled -> disabled
          // move into main container
          moveTeleport(
            n2,
            container,
            mainAnchor,
            internals,
            TeleportMoveTypes.TOGGLE,
          )
        } else {
          // #7835
          // When `teleport` is disabled, `to` may change, making it always old,
          // to ensure the correct `to` when enabled
          if (n2.props && n1.props && n2.props.to !== n1.props.to) {
            n2.props.to = n1.props.to
          }
        }
      } else {
        // target changed
        if ((n2.props && n2.props.to) !== (n1.props && n1.props.to)) {
          const nextTarget = (n2.target = resolveTarget(
            n2.props,
            querySelector,
          ))
          if (nextTarget) {
            moveTeleport(
              n2,
              nextTarget,
              null,
              internals,
              TeleportMoveTypes.TARGET_CHANGE,
            )
          } else if (__DEV__) {
            warn(
              'Invalid Teleport target on update:',
              target,
              `(${typeof target})`,
            )
          }
        } else if (wasDisabled) {
          // disabled -> enabled
          // move into teleport target
          moveTeleport(
            n2,
            target,
            targetAnchor,
            internals,
            TeleportMoveTypes.TOGGLE,
          )
        }
      }
      updateCssVars(n2, disabled)
    }
  },

  remove(
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    { um: unmount, o: { remove: hostRemove } }: RendererInternals,
    doRemove: boolean,
  ): void {
    const {
      shapeFlag,
      children,
      anchor,
      targetStart,
      targetAnchor,
      target,
      props,
    } = vnode

    if (target) {
      hostRemove(targetStart!)
      hostRemove(targetAnchor!)
    }

    // an unmounted teleport should always unmount its children whether it's disabled or not
    doRemove && hostRemove(anchor!)
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      const shouldRemove = doRemove || !isTeleportDisabled(props)
      for (let i = 0; i < (children as VNode[]).length; i++) {
        const child = (children as VNode[])[i]
        unmount(
          child,
          parentComponent,
          parentSuspense,
          shouldRemove,
          !!child.dynamicChildren,
        )
      }
    }
  },

  move: moveTeleport as typeof moveTeleport,
  hydrate: hydrateTeleport as typeof hydrateTeleport,
}

// Force-casted public typing for h and TSX props inference
export const Teleport = TeleportImpl as unknown as {
  __isTeleport: true
  new(): {
    $props: VNodeProps & TeleportProps
    $slots: {
      default(): VNode[]
    }
  }
}

// Suspense exposes a component-like API, and is treated like a component
// in the compiler, but internally it's a special built-in type that hooks
// directly into the renderer.
export const SuspenseImpl = {
  name: 'Suspense',
  // In order to make Suspense tree-shakable, we need to avoid importing it
  // directly in the renderer. The renderer checks for the __isSuspense flag
  // on a vnode's type and calls the `process` method, passing in renderer
  // internals.
  __isSuspense: true,
  process(
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    namespace: ElementNamespace,
    slotScopeIds: string[] | null,
    optimized: boolean,
    // platform-specific impl passed from renderer
    rendererInternals: RendererInternals,
  ): void {
    if (n1 == null) {
      mountSuspense(
        n2,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        optimized,
        rendererInternals,
      )
    } else {
      // #8678 if the current suspense needs to be patched and parentSuspense has
      // not been resolved. this means that both the current suspense and parentSuspense
      // need to be patched. because parentSuspense's pendingBranch includes the
      // current suspense, it will be processed twice:
      //  1. current patch
      //  2. mounting along with the pendingBranch of parentSuspense
      // it is necessary to skip the current patch to avoid multiple mounts
      // of inner components.
      if (
        parentSuspense &&
        parentSuspense.deps > 0 &&
        !n1.suspense!.isInFallback
      ) {
        n2.suspense = n1.suspense!
        n2.suspense.vnode = n2
        n2.el = n1.el
        return
      }
      patchSuspense(
        n1,
        n2,
        container,
        anchor,
        parentComponent,
        namespace,
        slotScopeIds,
        optimized,
        rendererInternals,
      )
    }
  },
  hydrate: hydrateSuspense as typeof hydrateSuspense,
  normalize: normalizeSuspenseChildren as typeof normalizeSuspenseChildren,
}

export const Suspense = (__FEATURE_SUSPENSE__
  ? SuspenseImpl
  : null) as unknown as {
    __isSuspense: true
    new(): {
      $props: VNodeProps & SuspenseProps
      $slots: {
        default(): VNode[]
        fallback(): VNode[]
      }
    }
  }

/**** render ***/
export const devtoolsComponentAdded: DevtoolsComponentHook =
  /*@__PURE__*/ createDevtoolsComponentHook(DevtoolsHooks.COMPONENT_ADDED)
export const devtoolsComponentRemoved = (
  component: ComponentInternalInstance,
): void => {
  if (
    devtools &&
    typeof devtools.cleanupBuffer === 'function' &&
    // remove the component if it wasn't buffered
    !devtools.cleanupBuffer(component)
  ) {
    _devtoolsComponentRemoved(component)
  }
}
const _devtoolsComponentRemoved = /*@__PURE__*/ createDevtoolsComponentHook(
  DevtoolsHooks.COMPONENT_REMOVED,
)

export function createRenderer<
  HostNode = RendererNode,
  HostElement = RendererElement
>(options: RendererOptions<HostNode, HostElement>): Renderer<HostElement> {
  return baseCreateRenderer<HostNode, HostElement>(options)
}

// overload 1: no hydration
function baseCreateRenderer<
  HostNode = RendererNode,
  HostElement = RendererElement
>(options: RendererOptions<HostNode, HostElement>): Renderer<HostElement>

// overload 2: with hydration
function baseCreateRenderer(
  options: RendererOptions<Node, Element>,
  createHydrationFns: typeof createHydrationFunctions
): HydrationRenderer

// implementation
function baseCreateRenderer(
  options: RendererOptions,
  createHydrationFns?: typeof createHydrationFunctions
): any {
  // compile-time feature flags check
  if (__ESM_BUNDLER__ && !__TEST__) {
    initFeatureFlags()
  }

  const target = getGlobalThis()
  target.__VUE__ = true
  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    setDevtoolsHook(target.__VUE_DEVTOOLS_GLOBAL_HOOK__, target)
  }

  const {
    insert: hostInsert,
    remove: hostRemove,
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    createComment: hostCreateComment,
    setText: hostSetText,
    setElementText: hostSetElementText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    setScopeId: hostSetScopeId = NOOP,
    insertStaticContent: hostInsertStaticContent
  } = options

  // Note: functions inside this closure should use `const xxx = () => {}`
  // style in order to prevent being inlined by minifiers.
  const patch: PatchFn = (
    n1,
    n2,
    container,
    anchor = null,
    parentComponent = null,
    parentSuspense = null,
    namespace = undefined,
    slotScopeIds = null,
    optimized = __DEV__ && isHmrUpdating ? false : !!n2.dynamicChildren
  ) => {
    if (n1 === n2) {
      return
    }

    // patching & not same type, unmount old tree
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
          mountStaticNode(n2, container, anchor, namespace)
        } else if (__DEV__) {
          patchStaticNode(n1, n2, container, namespace)
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
          namespace,
          slotScopeIds,
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
            namespace,
            slotScopeIds,
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
            namespace,
            slotScopeIds,
            optimized
          )
        } else if (shapeFlag & ShapeFlags.TELEPORT) {
          ; (type as typeof TeleportImpl).process(
            n1 as TeleportVNode,
            n2 as TeleportVNode,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized,
            internals
          )
        } else if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
          ; (type as typeof SuspenseImpl).process(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized,
            internals
          )
        } else if (__DEV__) {
          warn('Invalid VNode type:', type, `(${typeof type})`)
        }
    }

    // set ref
    if (ref != null && parentComponent) {
      setRef(ref, n1 && n1.ref, parentSuspense, n2 || n1, !n2)
    } else if (ref == null && n1 && n1.ref != null) {
      setRef(n1.ref, null, parentSuspense, n1, true)
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
    n1,
    n2,
    container,
    anchor
  ) => {
    if (n1 == null) {
      hostInsert(
        (n2.el = hostCreateComment((n2.children as string) || '')),
        container,
        anchor
      )
    } else {
      // there's no support for dynamic comments
      n2.el = n1.el
    }
  }

  const mountStaticNode = (
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    namespace: ElementNamespace
  ) => {
    // static nodes are only present when used with compiler-dom/runtime-dom
    // which guarantees presence of hostInsertStaticContent.
    ;[n2.el, n2.anchor] = hostInsertStaticContent!(
      n2.children as string,
      container,
      anchor,
      namespace,
      n2.el,
      n2.anchor
    )
  }

  /**
   * Dev / HMR only
   */
  const patchStaticNode = (
    n1: VNode,
    n2: VNode,
    container: RendererElement,
    namespace: ElementNamespace
  ) => {
    // static nodes are only patched during dev for HMR
    if (n2.children !== n1.children) {
      const anchor = hostNextSibling(n1.anchor!)
      // remove existing
      removeStaticNode(n1)
        // insert new
        ;[n2.el, n2.anchor] = hostInsertStaticContent!(
          n2.children as string,
          container,
          anchor,
          namespace
        )
    } else {
      n2.el = n1.el
      n2.anchor = n1.anchor
    }
  }

  const moveStaticNode = (
    { el, anchor }: VNode,
    container: RendererElement,
    nextSibling: RendererNode | null
  ) => {
    let next
    while (el && el !== anchor) {
      next = hostNextSibling(el)
      hostInsert(el, container, nextSibling)
      el = next
    }
    hostInsert(anchor!, container, nextSibling)
  }

  const removeStaticNode = ({ el, anchor }: VNode) => {
    let next
    while (el && el !== anchor) {
      next = hostNextSibling(el)
      hostRemove(el)
      el = next
    }
    hostRemove(anchor!)
  }

  const processElement = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    namespace: ElementNamespace,
    slotScopeIds: string[] | null,
    optimized: boolean
  ) => {
    if (n2.type === 'svg') {
      namespace = 'svg'
    } else if (n2.type === 'math') {
      namespace = 'mathml'
    }

    if (n1 == null) {
      mountElement(
        n2,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        optimized
      )
    } else {
      patchElement(
        n1,
        n2,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        optimized
      )
    }
  }

  const mountElement = (
    vnode: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    namespace: ElementNamespace,
    slotScopeIds: string[] | null,
    optimized: boolean
  ) => {
    let el: RendererElement
    let vnodeHook: VNodeHook | undefined | null
    const { props, shapeFlag, transition, dirs } = vnode

    el = vnode.el = hostCreateElement(
      vnode.type as string,
      namespace,
      props && props.is,
      props
    )

    // mount children first, since some props may rely on child content
    // being already rendered, e.g. `<select value>`
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      hostSetElementText(el, vnode.children as string)
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      mountChildren(
        vnode.children as VNodeArrayChildren,
        el,
        null,
        parentComponent,
        parentSuspense,
        resolveChildrenNamespace(vnode, namespace),
        slotScopeIds,
        optimized
      )
    }

    if (dirs) {
      invokeDirectiveHook(vnode, null, parentComponent, 'created')
    }
    // scopeId
    setScopeId(el, vnode, vnode.scopeId, slotScopeIds, parentComponent)
    // props
    if (props) {
      for (const key in props) {
        if (key !== 'value' && !isReservedProp(key)) {
          hostPatchProp(el, key, null, props[key], namespace, parentComponent)
        }
      }
      /**
       * Special case for setting value on DOM elements:
       * - it can be order-sensitive (e.g. should be set *after* min/max, #2325, #4024)
       * - it needs to be forced (#1471)
       * #2353 proposes adding another renderer option to configure this, but
       * the properties affects are so finite it is worth special casing it
       * here to reduce the complexity. (Special casing it also should not
       * affect non-DOM renderers)
       */
      if ('value' in props) {
        hostPatchProp(el, 'value', null, props.value, namespace)
      }
      if ((vnodeHook = props.onVnodeBeforeMount)) {
        invokeVNodeHook(vnodeHook, parentComponent, vnode)
      }
    }

    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      def(el, '__vnode', vnode, true)
      def(el, '__vueParentComponent', parentComponent, true)
    }

    if (dirs) {
      invokeDirectiveHook(vnode, null, parentComponent, 'beforeMount')
    }
    // #1583 For inside suspense + suspense not resolved case, enter hook should call when suspense resolved
    // #1689 For inside suspense + suspense resolved case, just call it
    const needCallTransitionHooks = needTransition(parentSuspense, transition)
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
    vnode: VNode,
    scopeId: string | null,
    slotScopeIds: string[] | null,
    parentComponent: ComponentInternalInstance | null
  ) => {
    if (scopeId) {
      hostSetScopeId(el, scopeId)
    }
    if (slotScopeIds) {
      for (let i = 0; i < slotScopeIds.length; i++) {
        hostSetScopeId(el, slotScopeIds[i])
      }
    }
    if (parentComponent) {
      let subTree = parentComponent.subTree
      if (
        __DEV__ &&
        subTree.patchFlag > 0 &&
        subTree.patchFlag & PatchFlags.DEV_ROOT_FRAGMENT
      ) {
        subTree =
          filterSingleRoot(subTree.children as VNodeArrayChildren) || subTree
      }
      if (
        vnode === subTree ||
        (isSuspense(subTree.type) &&
          (subTree.ssContent === vnode || subTree.ssFallback === vnode))
      ) {
        const parentVNode = parentComponent.vnode
        setScopeId(
          el,
          parentVNode,
          parentVNode.scopeId,
          parentVNode.slotScopeIds,
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
    namespace: ElementNamespace,
    slotScopeIds,
    optimized,
    start = 0
  ) => {
    for (let i = start; i < children.length; i++) {
      const child = (children[i] = optimized
        ? cloneIfMounted(children[i] as VNode)
        : normalizeVNode(children[i]))
      patch(
        null,
        child,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        optimized
      )
    }
  }

  const patchElement = (
    n1: VNode,
    n2: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    namespace: ElementNamespace,
    slotScopeIds: string[] | null,
    optimized: boolean
  ) => {
    const el = (n2.el = n1.el!)
    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      el.__vnode = n2
    }
    let { patchFlag, dynamicChildren, dirs } = n2
    // #1426 take the old vnode's patch flag into account since user may clone a
    // compiler-generated vnode, which de-opts to FULL_PROPS
    patchFlag |= n1.patchFlag & PatchFlags.FULL_PROPS
    const oldProps = n1.props || EMPTY_OBJ
    const newProps = n2.props || EMPTY_OBJ
    let vnodeHook: VNodeHook | undefined | null

    // disable recurse in beforeUpdate hooks
    parentComponent && toggleRecurse(parentComponent, false)
    if ((vnodeHook = newProps.onVnodeBeforeUpdate)) {
      invokeVNodeHook(vnodeHook, parentComponent, n2, n1)
    }
    if (dirs) {
      invokeDirectiveHook(n2, n1, parentComponent, 'beforeUpdate')
    }
    parentComponent && toggleRecurse(parentComponent, true)

    if (__DEV__ && isHmrUpdating) {
      // HMR updated, force full diff
      patchFlag = 0
      optimized = false
      dynamicChildren = null
    }

    // #9135 innerHTML / textContent unset needs to happen before possible
    // new children mount
    if (
      (oldProps.innerHTML && newProps.innerHTML == null) ||
      (oldProps.textContent && newProps.textContent == null)
    ) {
      hostSetElementText(el, '')
    }

    if (dynamicChildren) {
      patchBlockChildren(
        n1.dynamicChildren!,
        dynamicChildren,
        el,
        parentComponent,
        parentSuspense,
        resolveChildrenNamespace(n2, namespace),
        slotScopeIds
      )
      if (__DEV__) {
        // necessary for HMR
        traverseStaticChildren(n1, n2)
      }
    } else if (!optimized) {
      // full diff
      patchChildren(
        n1,
        n2,
        el,
        null,
        parentComponent,
        parentSuspense,
        resolveChildrenNamespace(n2, namespace),
        slotScopeIds,
        false
      )
    }

    if (patchFlag > 0) {
      // the presence of a patchFlag means this element's render code was
      // generated by the compiler and can take the fast path.
      // in this path old node and new node are guaranteed to have the same shape
      // (i.e. at the exact same position in the source template)
      if (patchFlag & PatchFlags.FULL_PROPS) {
        // element props contain dynamic keys, full diff needed
        patchProps(el, oldProps, newProps, parentComponent, namespace)
      } else {
        // class
        // this flag is matched when the element has dynamic class bindings.
        if (patchFlag & PatchFlags.CLASS) {
          if (oldProps.class !== newProps.class) {
            hostPatchProp(el, 'class', null, newProps.class, namespace)
          }
        }

        // style
        // this flag is matched when the element has dynamic style bindings
        if (patchFlag & PatchFlags.STYLE) {
          hostPatchProp(el, 'style', oldProps.style, newProps.style, namespace)
        }

        // props
        // This flag is matched when the element has dynamic prop/attr bindings
        // other than class and style. The keys of dynamic prop/attrs are saved for
        // faster iteration.
        // Note dynamic keys like :[foo]="bar" will cause this optimization to
        // bail out and go through a full diff because we need to unset the old key
        if (patchFlag & PatchFlags.PROPS) {
          // if the flag is present then dynamicProps must be non-null
          const propsToUpdate = n2.dynamicProps!
          for (let i = 0; i < propsToUpdate.length; i++) {
            const key = propsToUpdate[i]
            const prev = oldProps[key]
            const next = newProps[key]
            // #1471 force patch value
            if (next !== prev || key === 'value') {
              hostPatchProp(el, key, prev, next, namespace, parentComponent)
            }
          }
        }
      }

      // text
      // This flag is matched when the element has only dynamic text children.
      if (patchFlag & PatchFlags.TEXT) {
        if (n1.children !== n2.children) {
          hostSetElementText(el, n2.children as string)
        }
      }
    } else if (!optimized && dynamicChildren == null) {
      // unoptimized, full diff
      patchProps(el, oldProps, newProps, parentComponent, namespace)
    }

    if ((vnodeHook = newProps.onVnodeUpdated) || dirs) {
      queuePostRenderEffect(() => {
        vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, n2, n1)
        dirs && invokeDirectiveHook(n2, n1, parentComponent, 'updated')
      }, parentSuspense)
    }
  }

  // The fast path for blocks.
  const patchBlockChildren: PatchBlockChildrenFn = (
    oldChildren,
    newChildren,
    fallbackContainer,
    parentComponent,
    parentSuspense,
    namespace: ElementNamespace,
    slotScopeIds
  ) => {
    for (let i = 0; i < newChildren.length; i++) {
      const oldVNode = oldChildren[i]
      const newVNode = newChildren[i]
      // Determine the container (parent element) for the patch.
      const container =
        // oldVNode may be an errored async setup() component inside Suspense
        // which will not have a mounted element
        oldVNode.el &&
          // - In the case of a Fragment, we need to provide the actual parent
          // of the Fragment itself so it can move its children.
          (oldVNode.type === Fragment ||
            // - In the case of different nodes, there is going to be a replacement
            // which also requires the correct parent container
            !isSameVNodeType(oldVNode, newVNode) ||
            // - In the case of a component, it could contain anything.
            oldVNode.shapeFlag &
            (ShapeFlags.COMPONENT | ShapeFlags.TELEPORT | ShapeFlags.SUSPENSE))
          ? hostParentNode(oldVNode.el)!
          : // In other cases, the parent container is not actually used so we
          // just pass the block element here to avoid a DOM parentNode call.
          fallbackContainer
      patch(
        oldVNode,
        newVNode,
        container,
        null,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        true
      )
    }
  }

  const patchProps = (
    el: RendererElement,
    oldProps: Data,
    newProps: Data,
    parentComponent: ComponentInternalInstance | null,
    namespace: ElementNamespace
  ) => {
    if (oldProps !== newProps) {
      if (oldProps !== EMPTY_OBJ) {
        for (const key in oldProps) {
          if (!isReservedProp(key) && !(key in newProps)) {
            hostPatchProp(
              el,
              key,
              oldProps[key],
              null,
              namespace,
              parentComponent
            )
          }
        }
      }
      for (const key in newProps) {
        // empty string is not valid prop
        if (isReservedProp(key)) continue
        const next = newProps[key]
        const prev = oldProps[key]
        // defer patching value
        if (next !== prev && key !== 'value') {
          hostPatchProp(el, key, prev, next, namespace, parentComponent)
        }
      }
      if ('value' in newProps) {
        hostPatchProp(el, 'value', oldProps.value, newProps.value, namespace)
      }
    }
  }

  const processFragment = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    namespace: ElementNamespace,
    slotScopeIds: string[] | null,
    optimized: boolean
  ) => {
    const fragmentStartAnchor = (n2.el = n1 ? n1.el : hostCreateText(''))!
    const fragmentEndAnchor = (n2.anchor = n1 ? n1.anchor : hostCreateText(''))!

    let { patchFlag, dynamicChildren, slotScopeIds: fragmentSlotScopeIds } = n2

    if (
      __DEV__ &&
      // #5523 dev root fragment may inherit directives
      (isHmrUpdating || patchFlag & PatchFlags.DEV_ROOT_FRAGMENT)
    ) {
      // HMR updated / Dev root fragment (w/ comments), force full diff
      patchFlag = 0
      optimized = false
      dynamicChildren = null
    }

    // check if this is a slot fragment with :slotted scope ids
    if (fragmentSlotScopeIds) {
      slotScopeIds = slotScopeIds
        ? slotScopeIds.concat(fragmentSlotScopeIds)
        : fragmentSlotScopeIds
    }

    if (n1 == null) {
      hostInsert(fragmentStartAnchor, container, anchor)
      hostInsert(fragmentEndAnchor, container, anchor)
      // a fragment can only have array children
      // since they are either generated by the compiler, or implicitly created
      // from arrays.
      mountChildren(
        // #10007
        // such fragment like `<></>` will be compiled into
        // a fragment which doesn't have a children.
        // In this case fallback to an empty array
        (n2.children || []) as VNodeArrayChildren,
        container,
        fragmentEndAnchor,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        optimized
      )
    } else {
      if (
        patchFlag > 0 &&
        patchFlag & PatchFlags.STABLE_FRAGMENT &&
        dynamicChildren &&
        // #2715 the previous fragment could've been a BAILed one as a result
        // of renderSlot() with no valid children
        n1.dynamicChildren
      ) {
        // a stable fragment (template root or <template v-for>) doesn't need to
        // patch children order, but it may contain dynamicChildren.
        patchBlockChildren(
          n1.dynamicChildren,
          dynamicChildren,
          container,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds
        )
        if (__DEV__) {
          // necessary for HMR
          traverseStaticChildren(n1, n2)
        } else if (
          // #2080 if the stable fragment has a key, it's a <template v-for> that may
          //  get moved around. Make sure all root level vnodes inherit el.
          // #2134 or if it's a component root, it may also get moved around
          // as the component is being moved.
          n2.key != null ||
          (parentComponent && n2 === parentComponent.subTree)
        ) {
          traverseStaticChildren(n1, n2, true /* shallow */)
        }
      } else {
        // keyed / unkeyed, or manual fragments.
        // for keyed & unkeyed, since they are compiler generated from v-for,
        // each child is guaranteed to be a block so the fragment will never
        // have dynamicChildren.
        patchChildren(
          n1,
          n2,
          container,
          fragmentEndAnchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
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
    namespace: ElementNamespace,
    slotScopeIds: string[] | null,
    optimized: boolean
  ) => {
    n2.slotScopeIds = slotScopeIds
    if (n1 == null) {
      if (n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
        ; (parentComponent!.ctx as KeepAliveContext).activate(
          n2,
          container,
          anchor,
          namespace,
          optimized
        )
      } else {
        mountComponent(
          n2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          optimized
        )
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
    namespace: ElementNamespace,
    optimized
  ) => {
    // 2.x compat may pre-create the component instance before actually
    // mounting
    const compatMountInstance =
      __COMPAT__ && initialVNode.isCompatRoot && initialVNode.component
    const instance: ComponentInternalInstance =
      compatMountInstance ||
      (initialVNode.component = createComponentInstance(
        initialVNode,
        parentComponent,
        parentSuspense
      ))

    if (__DEV__ && instance.type.__hmrId) {
      registerHMR(instance)
    }

    if (__DEV__) {
      pushWarningContext(initialVNode)
      startMeasure(instance, `mount`)
    }

    // inject renderer internals for keepAlive
    if (isKeepAlive(initialVNode)) {
      ; (instance.ctx as KeepAliveContext).renderer = internals
    }

    // resolve props and slots for setup context
    if (!(__COMPAT__ && compatMountInstance)) {
      if (__DEV__) {
        startMeasure(instance, `init`)
      }
      setupComponent(instance, false, optimized)
      if (__DEV__) {
        endMeasure(instance, `init`)
      }
    }

    // avoid hydration for hmr updating
    if (__DEV__ && isHmrUpdating) initialVNode.el = null

    // setup() is async. This component relies on async logic to be resolved
    // before proceeding
    if (__FEATURE_SUSPENSE__ && instance.asyncDep) {
      parentSuspense &&
        parentSuspense.registerDep(instance, setupRenderEffect, optimized)

      // Give it a placeholder if this is not hydration
      // TODO handle self-defined fallback
      if (!initialVNode.el) {


        const placeholder = (instance.subTree = createVNode(Comment))
        processCommentNode(null, placeholder, container!, anchor)
        initialVNode.placeholder = placeholder.el
      }
    } else {
      setupRenderEffect(
        instance,
        initialVNode,
        container,
        anchor,
        parentSuspense,
        namespace,
        optimized
      )
    }

    if (__DEV__) {
      popWarningContext()
      endMeasure(instance, `mount`)
    }
  }

  const updateComponent = (n1: VNode, n2: VNode, optimized: boolean) => {
    const instance = (n2.component = n1.component)!
    if (shouldUpdateComponent(n1, n2, optimized)) {
      if (
        __FEATURE_SUSPENSE__ &&
        instance.asyncDep &&
        !instance.asyncResolved
      ) {
        // async & still pending - just update props and slots
        // since the component's reactive effect for render isn't set-up yet
        if (__DEV__) {
          pushWarningContext(n2)
        }
        updateComponentPreRender(instance, n2, optimized)
        if (__DEV__) {
          popWarningContext()
        }
        return
      } else {
        // normal update
        instance.next = n2
        // instance.update is the reactive effect.
        instance.update()
      }
    } else {
      // no update needed. just copy over properties
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
    namespace: ElementNamespace,
    optimized
  ) => {
    const componentUpdateFn = () => {
      if (!instance.isMounted) {
        let vnodeHook: VNodeHook | null | undefined
        const { el, props } = initialVNode
        const { bm, m, parent, root, type } = instance
        const isAsyncWrapperVNode = isAsyncWrapper(initialVNode)

        toggleRecurse(instance, false)
        // beforeMount hook
        if (bm) {
          invokeArrayFns(bm)
        }
        // onVnodeBeforeMount
        if (
          !isAsyncWrapperVNode &&
          (vnodeHook = props && props.onVnodeBeforeMount)
        ) {
          invokeVNodeHook(vnodeHook, parent, initialVNode)
        }
        if (
          __COMPAT__ &&
          isCompatEnabled(DeprecationTypes.INSTANCE_EVENT_HOOKS, instance)
        ) {
          instance.emit('hook:beforeMount')
        }
        toggleRecurse(instance, true)

        if (el && hydrateNode) {
          // vnode has adopted host node - perform hydration instead of mount.
          const hydrateSubTree = () => {
            if (__DEV__) {
              startMeasure(instance, `render`)
            }
            instance.subTree = renderComponentRoot(instance)

            if (__DEV__) {
              endMeasure(instance, `render`)
            }
            if (__DEV__) {
              startMeasure(instance, `hydrate`)
            }
            hydrateNode!(
              el as Node,
              instance.subTree,
              instance,
              parentSuspense,
              null
            )
            if (__DEV__) {
              endMeasure(instance, `hydrate`)
            }
          }

          if (
            isAsyncWrapperVNode &&
            (type as ComponentOptions).__asyncHydrate
          ) {
            ; (type as ComponentOptions).__asyncHydrate!(
              el as Element,
              instance,
              hydrateSubTree
            )
          } else {
            hydrateSubTree()
          }
        } else {
          // custom element style injection
          if (
            root.ce &&
            // @ts-expect-error _def is private
            (root.ce as VueElement)._def.shadowRoot !== false
          ) {
            root.ce._injectChildStyle(type)
          }

          if (__DEV__) {
            startMeasure(instance, `render`)
          }
          const subTree = (instance.subTree = renderComponentRoot(instance))
          if (__DEV__) {
            endMeasure(instance, `render`)
          }
          if (__DEV__) {
            startMeasure(instance, `patch`)
          }
          patch(
            null,
            subTree,
            container,
            anchor,
            instance,
            parentSuspense,
            namespace
          )
          if (__DEV__) {
            endMeasure(instance, `patch`)
          }
          initialVNode.el = subTree.el
        }
        // mounted hook
        if (m) {
          queuePostRenderEffect(m, parentSuspense)
        }
        // onVnodeMounted
        if (
          !isAsyncWrapperVNode &&
          (vnodeHook = props && props.onVnodeMounted)
        ) {
          const scopedInitialVNode = initialVNode
          queuePostRenderEffect(
            () => invokeVNodeHook(vnodeHook!, parent, scopedInitialVNode),
            parentSuspense
          )
        }
        if (
          __COMPAT__ &&
          isCompatEnabled(DeprecationTypes.INSTANCE_EVENT_HOOKS, instance)
        ) {
          queuePostRenderEffect(
            () => instance.emit('hook:mounted'),
            parentSuspense
          )
        }

        // activated hook for keep-alive roots.
        // #1742 activated hook must be accessed after first render
        // since the hook may be injected by a child keep-alive
        if (
          initialVNode.shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE ||
          (parent &&
            isAsyncWrapper(parent.vnode) &&
            parent.vnode.shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE)
        ) {
          instance.a && queuePostRenderEffect(instance.a, parentSuspense)
          if (
            __COMPAT__ &&
            isCompatEnabled(DeprecationTypes.INSTANCE_EVENT_HOOKS, instance)
          ) {
            queuePostRenderEffect(
              () => instance.emit('hook:activated'),
              parentSuspense
            )
          }
        }
        instance.isMounted = true

        if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
          devtoolsComponentAdded(instance)
        }

        // #2458: deference mount-only object parameters to prevent memleaks
        initialVNode = container = anchor = null as any
      } else {
        let { next, bu, u, parent, vnode } = instance
        if (__FEATURE_SUSPENSE__) {
          const nonHydratedAsyncRoot = locateNonHydratedAsyncRoot(instance)
          // we are trying to update some async comp before hydration
          // this will cause crash because we don't know the root node yet
          if (nonHydratedAsyncRoot) {
            // only sync the properties and abort the rest of operations
            if (next) {
              next.el = vnode.el
              updateComponentPreRender(instance, next, optimized)
            }
            // and continue the rest of operations once the deps are resolved
            nonHydratedAsyncRoot.asyncDep!.then(() => {
              // the instance may be destroyed during the time period
              if (!instance.isUnmounted) {
                componentUpdateFn()
              }
            })
            return
          }
        }

        // updateComponent
        // This is triggered by mutation of component's own state (next: null)
        // OR parent calling processComponent (next: VNode)
        let originNext = next
        let vnodeHook: VNodeHook | null | undefined
        if (__DEV__) {
          pushWarningContext(next || instance.vnode)
        }

        // Disallow component effect recursion during pre-lifecycle hooks.
        toggleRecurse(instance, false)
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
        // onVnodeBeforeUpdate
        if ((vnodeHook = next.props && next.props.onVnodeBeforeUpdate)) {
          invokeVNodeHook(vnodeHook, parent, next, vnode)
        }
        if (
          __COMPAT__ &&
          isCompatEnabled(DeprecationTypes.INSTANCE_EVENT_HOOKS, instance)
        ) {
          instance.emit('hook:beforeUpdate')
        }
        toggleRecurse(instance, true)

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
          startMeasure(instance, `patch`)
        }

        patch(
          prevTree,
          nextTree,
          // parent may have changed if it's in a teleport
          hostParentNode(prevTree.el!)!,
          // anchor may have changed if it's in a fragment
          // TODO
          getNextHostNode(prevTree),
          instance,
          parentSuspense,
          namespace
        )
        if (__DEV__) {
          endMeasure(instance, `patch`)
        }
        next.el = nextTree.el
        if (originNext === null) {
          // self-triggered update. In case of HOC, update parent component
          // vnode el. HOC is indicated by parent instance's subTree pointing
          // to child component's vnode
          updateHOCHostEl(instance, nextTree.el)
        }
        // updated hook
        if (u) {
          queuePostRenderEffect(u, parentSuspense)
        }
        // onVnodeUpdated
        if ((vnodeHook = next.props && next.props.onVnodeUpdated)) {
          queuePostRenderEffect(
            () => invokeVNodeHook(vnodeHook!, parent, next!, vnode),
            parentSuspense
          )
        }
        if (
          __COMPAT__ &&
          isCompatEnabled(DeprecationTypes.INSTANCE_EVENT_HOOKS, instance)
        ) {
          queuePostRenderEffect(
            () => instance.emit('hook:updated'),
            parentSuspense
          )
        }

        if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
          devtoolsComponentUpdated(instance)
        }

        if (__DEV__) {
          popWarningContext()
        }
      }
    }

    // create reactive effect for rendering
    instance.scope.on()
    const effect = (instance.effect = new ReactiveEffect(componentUpdateFn))
    instance.scope.off()

    const update = (instance.update = effect.run.bind(effect))
    const job: SchedulerJob = (instance.job = effect.runIfDirty.bind(effect))
    job.i = instance
    job.id = instance.uid
    effect.scheduler = () => queueJob(job)

    // allowRecurse
    // #1801, #2043 component render effects should allow recursive updates
    toggleRecurse(instance, true)

    if (__DEV__) {
      effect.onTrack = instance.rtc
        ? e => invokeArrayFns(instance.rtc!, e)
        : void 0
      effect.onTrigger = instance.rtg
        ? e => invokeArrayFns(instance.rtg!, e)
        : void 0
    }

    update()
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
    updateSlots(instance, nextVNode.children, optimized)

    pauseTracking()
    // props update may have triggered pre-flush watchers.
    // flush them before the render update.
    flushPreFlushCbs(instance)
    resetTracking()
  }

  const patchChildren: PatchChildrenFn = (
    n1,
    n2,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    namespace: ElementNamespace,
    slotScopeIds,
    optimized = false
  ) => {
    const c1 = n1 && n1.children
    const prevShapeFlag = n1 ? n1.shapeFlag : 0
    const c2 = n2.children

    const { patchFlag, shapeFlag } = n2
    // fast path
    if (patchFlag > 0) {
      if (patchFlag & PatchFlags.KEYED_FRAGMENT) {
        // this could be either fully-keyed or mixed (some keyed some not)
        // presence of patchFlag means children are guaranteed to be arrays
        patchKeyedChildren(
          c1 as VNode[],
          c2 as VNodeArrayChildren,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
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
          namespace,
          slotScopeIds,
          optimized
        )
        return
      }
    }

    // children has 3 possibilities: text, array or no children.
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
        // prev children was array
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // two arrays, cannot assume anything, do full diff
          patchKeyedChildren(
            c1 as VNode[],
            c2 as VNodeArrayChildren,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          )
        } else {
          // no new children, just unmount old
          unmountChildren(c1 as VNode[], parentComponent, parentSuspense, true)
        }
      } else {
        // prev children was text OR null
        // new children is array OR null
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          hostSetElementText(container, '')
        }
        // mount new if array
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(
            c2 as VNodeArrayChildren,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
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
    namespace: ElementNamespace,
    slotScopeIds: string[] | null,
    optimized: boolean
  ) => {
    c1 = c1 || EMPTY_ARR
    c2 = c2 || EMPTY_ARR
    const oldLength = c1.length
    const newLength = c2.length
    const commonLength = Math.min(oldLength, newLength)
    let i
    for (i = 0; i < commonLength; i++) {
      const nextChild = (c2[i] = optimized
        ? cloneIfMounted(c2[i] as VNode)
        : normalizeVNode(c2[i]))
      patch(
        c1[i],
        nextChild,
        container,
        null,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        optimized
      )
    }
    if (oldLength > newLength) {
      // remove old
      unmountChildren(
        c1,
        parentComponent,
        parentSuspense,
        true,
        false,
        commonLength
      )
    } else {
      // mount new
      mountChildren(
        c2,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        optimized,
        commonLength
      )
    }
  }

  // can be all-keyed or mixed
  const patchKeyedChildren = (
    c1: VNode[],
    c2: VNodeArrayChildren,
    container: RendererElement,
    parentAnchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    namespace: ElementNamespace,
    slotScopeIds: string[] | null,
    optimized: boolean
  ) => {
    let i = 0
    const l2 = c2.length
    let e1 = c1.length - 1 // prev ending index
    let e2 = l2 - 1 // next ending index

    // 1. sync from start
    // (a b) c
    // (a b) d e
    while (i <= e1 && i <= e2) {
      const n1 = c1[i]
      const n2 = (c2[i] = optimized
        ? cloneIfMounted(c2[i] as VNode)
        : normalizeVNode(c2[i]))
      if (isSameVNodeType(n1, n2)) {
        patch(
          n1,
          n2,
          container,
          null,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        )
      } else {
        break
      }
      i++
    }

    // 2. sync from end
    // a (b c)
    // d e (b c)
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1]
      const n2 = (c2[e2] = optimized
        ? cloneIfMounted(c2[e2] as VNode)
        : normalizeVNode(c2[e2]))
      if (isSameVNodeType(n1, n2)) {
        patch(
          n1,
          n2,
          container,
          null,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        )
      } else {
        break
      }
      e1--
      e2--
    }

    // 3. common sequence + mount
    // (a b)
    // (a b) c
    // i = 2, e1 = 1, e2 = 2
    // (a b)
    // c (a b)
    // i = 0, e1 = -1, e2 = 0
    if (i > e1) {
      if (i <= e2) {
        const nextPos = e2 + 1
        const anchor = nextPos < l2 ? (c2[nextPos] as VNode).el : parentAnchor
        while (i <= e2) {
          patch(
            null,
            (c2[i] = optimized
              ? cloneIfMounted(c2[i] as VNode)
              : normalizeVNode(c2[i])),
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          )
          i++
        }
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
      const s1 = i // prev starting index
      const s2 = i // next starting index

      // 5.1 build key:index map for newChildren
      const keyToNewIndexMap: Map<PropertyKey, number> = new Map()
      for (i = s2; i <= e2; i++) {
        const nextChild = (c2[i] = optimized
          ? cloneIfMounted(c2[i] as VNode)
          : normalizeVNode(c2[i]))
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

      // 5.2 loop through old children left to be patched and try to patch
      // matching nodes & remove nodes that are no longer present
      let j
      let patched = 0
      const toBePatched = e2 - s2 + 1
      let moved = false
      // used to track whether any node has moved
      let maxNewIndexSoFar = 0
      // works as Map<newIndex, oldIndex>
      // Note that oldIndex is offset by +1
      // and oldIndex = 0 is a special value indicating the new node has
      // no corresponding old node.
      // used for determining longest stable subsequence
      const newIndexToOldIndexMap = new Array(toBePatched)
      for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0

      for (i = s1; i <= e1; i++) {
        const prevChild = c1[i]
        if (patched >= toBePatched) {
          // all new children have been patched so this can only be a removal
          unmount(prevChild, parentComponent, parentSuspense, true)
          continue
        }
        let newIndex
        if (prevChild.key != null) {
          newIndex = keyToNewIndexMap.get(prevChild.key)
        } else {
          // key-less node, try to locate a key-less node of the same type
          for (j = s2; j <= e2; j++) {
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
            namespace,
            slotScopeIds,
            optimized
          )
          patched++
        }
      }

      // 5.3 move and mount
      // generate longest stable subsequence only when nodes have moved
      const increasingNewIndexSequence = moved
        ? getSequence(newIndexToOldIndexMap)
        : EMPTY_ARR
      j = increasingNewIndexSequence.length - 1
      // looping backwards so that we can use last patched node as anchor
      for (i = toBePatched - 1; i >= 0; i--) {
        const nextIndex = s2 + i
        const nextChild = c2[nextIndex] as VNode
        const anchorVNode = c2[nextIndex + 1] as VNode
        const anchor =
          nextIndex + 1 < l2
            ? // #13559, fallback to el placeholder for unresolved async component
            anchorVNode.el || anchorVNode.placeholder
            : parentAnchor
        if (newIndexToOldIndexMap[i] === 0) {
          // mount new
          patch(
            null,
            nextChild,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          )
        } else if (moved) {
          // move if:
          // There is no stable subsequence (e.g. a reverse)
          // OR current node is not among the stable sequence
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
      ; (type as typeof TeleportImpl).move(vnode, container, anchor, internals)
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

    if (type === Static) {
      moveStaticNode(vnode, container, anchor)
      return
    }

    // single nodes
    const needTransition =
      moveType !== MoveType.REORDER &&
      shapeFlag & ShapeFlags.ELEMENT &&
      transition
    if (needTransition) {
      if (moveType === MoveType.ENTER) {
        transition!.beforeEnter(el!)
        hostInsert(el!, container, anchor)
        queuePostRenderEffect(() => transition!.enter(el!), parentSuspense)
      } else {
        const { leave, delayLeave, afterLeave } = transition!
        const remove = () => {
          if (vnode.ctx!.isUnmounted) {
            hostRemove(el!)
          } else {
            hostInsert(el!, container, anchor)
          }
        }
        const performLeave = () => {
          // #13153 move kept-alive node before v-show transition leave finishes
          // it needs to call the leaving callback to ensure element's `display`
          // is `none`
          if (el!._isLeaving) {
            el![leaveCbKey](true /* cancelled */)
          }
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
    doRemove = false,
    optimized = false
  ) => {
    const {
      type,
      props,
      ref,
      children,
      dynamicChildren,
      shapeFlag,
      patchFlag,
      dirs,
      cacheIndex
    } = vnode

    if (patchFlag === PatchFlags.BAIL) {
      optimized = false
    }

    // unset ref
    if (ref != null) {
      pauseTracking()
      setRef(ref, null, parentSuspense, vnode, true)
      resetTracking()
    }

    // #6593 should clean memo cache when unmount
    if (cacheIndex != null) {
      parentComponent!.renderCache[cacheIndex] = undefined
    }

    if (shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
      ; (parentComponent!.ctx as KeepAliveContext).deactivate(vnode)
      return
    }

    const shouldInvokeDirs = shapeFlag & ShapeFlags.ELEMENT && dirs
    const shouldInvokeVnodeHook = !isAsyncWrapper(vnode)

    let vnodeHook: VNodeHook | undefined | null
    if (
      shouldInvokeVnodeHook &&
      (vnodeHook = props && props.onVnodeBeforeUnmount)
    ) {
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

      if (shapeFlag & ShapeFlags.TELEPORT) {
        ; (vnode.type as typeof TeleportImpl).remove(
          vnode,
          parentComponent,
          parentSuspense,
          internals,
          doRemove
        )
      } else if (
        dynamicChildren &&
        // #5154
        // when v-once is used inside a block, setBlockTracking(-1) marks the
        // parent block with hasOnce: true
        // so that it doesn't take the fast path during unmount - otherwise
        // components nested in v-once are never unmounted.
        !dynamicChildren.hasOnce &&
        // #1153: fast path should not be taken for non-stable (v-for) fragments
        (type !== Fragment ||
          (patchFlag > 0 && patchFlag & PatchFlags.STABLE_FRAGMENT))
      ) {
        // fast path for block nodes: only need to unmount dynamic children.
        unmountChildren(
          dynamicChildren,
          parentComponent,
          parentSuspense,
          false,
          true
        )
      } else if (
        (type === Fragment &&
          patchFlag &
          (PatchFlags.KEYED_FRAGMENT | PatchFlags.UNKEYED_FRAGMENT)) ||
        (!optimized && shapeFlag & ShapeFlags.ARRAY_CHILDREN)
      ) {
        unmountChildren(children as VNode[], parentComponent, parentSuspense)
      }

      if (doRemove) {
        remove(vnode)
      }
    }

    if (
      (shouldInvokeVnodeHook &&
        (vnodeHook = props && props.onVnodeUnmounted)) ||
      shouldInvokeDirs
    ) {
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
      if (
        __DEV__ &&
        vnode.patchFlag > 0 &&
        vnode.patchFlag & PatchFlags.DEV_ROOT_FRAGMENT &&
        transition &&
        !transition.persisted
      ) {
        ; (vnode.children as VNode[]).forEach(child => {
          if (child.type === Comment) {
            hostRemove(child.el!)
          } else {
            remove(child)
          }
        })
      } else {
        removeFragment(el!, anchor!)
      }
      return
    }

    if (type === Static) {
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
    // For fragments, directly remove all contained DOM nodes.
    // (fragment child nodes cannot have transition)
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
    if (__DEV__ && instance.type.__hmrId) {
      unregisterHMR(instance)
    }

    const { bum, scope, job, subTree, um, m, a } = instance
    invalidateMount(m)
    invalidateMount(a)

    // beforeUnmount hook
    if (bum) {
      invokeArrayFns(bum)
    }

    if (
      __COMPAT__ &&
      isCompatEnabled(DeprecationTypes.INSTANCE_EVENT_HOOKS, instance)
    ) {
      instance.emit('hook:beforeDestroy')
    }

    // stop effects in component scope
    scope.stop()

    // job may be null if a component is unmounted before its async
    // setup has resolved.
    if (job) {
      // so that scheduler will no longer invoke it
      job.flags! |= SchedulerJobFlags.DISPOSED
      unmount(subTree, instance, parentSuspense, doRemove)
    }
    // unmounted hook
    if (um) {
      queuePostRenderEffect(um, parentSuspense)
    }
    if (
      __COMPAT__ &&
      isCompatEnabled(DeprecationTypes.INSTANCE_EVENT_HOOKS, instance)
    ) {
      queuePostRenderEffect(
        () => instance.emit('hook:destroyed'),
        parentSuspense
      )
    }
    queuePostRenderEffect(() => {
      instance.isUnmounted = true
    }, parentSuspense)

    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      devtoolsComponentRemoved(instance)
    }
  }

  const unmountChildren: UnmountChildrenFn = (
    children,
    parentComponent,
    parentSuspense,
    doRemove = false,
    optimized = false,
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
    const el = hostNextSibling((vnode.anchor || vnode.el)!)
    // #9071, #9313
    // teleported content can mess up nextSibling searches during patch so
    // we need to skip them during nextSibling search
    const teleportEnd = el && el[TeleportEndKey]
    return teleportEnd ? hostNextSibling(teleportEnd) : el
  }

  let isFlushing = false
  const render: RootRenderFunction = (vnode, container, namespace) => {
    if (vnode == null) {
      if (container._vnode) {
        unmount(container._vnode, null, null, true)
      }
    } else {
      patch(
        container._vnode || null,
        vnode,
        container,
        null,
        null,
        null,
        namespace
      )
    }
    container._vnode = vnode
    if (!isFlushing) {
      isFlushing = true
      flushPreFlushCbs()
      flushPostFlushCbs()
      isFlushing = false
    }
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
    ;[hydrate, hydrateNode] = createHydrationFns(
      internals as RendererInternals<Node, Element>
    )
  }

  return {
    render,
    hydrate,
    createApp: createAppAPI(render, hydrate)
  }
}

// dev only
// In dev mode, the proxy target exposes the same properties as seen on `this`
// for easier console inspection. In prod mode it will be an empty object so
// these properties definitions can be skipped.
export function createDevRenderContext(instance: ComponentInternalInstance) {
  const target: Record<string, any> = {}

  // expose internal instance for proxy handlers
  Object.defineProperty(target, `_`, {
    configurable: true,
    enumerable: false,
    get: () => instance,
  })

  // expose public properties
  Object.keys(publicPropertiesMap).forEach(key => {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: false,
      get: () => publicPropertiesMap[key](instance),
      // intercepted by the proxy so no need for implementation,
      // but needed to prevent set errors
      set: NOOP,
    })
  })

  return target as ComponentRenderContext
}
export function createAppContext(): AppContext {
  return {
    app: null as any,
    config: {
      isNativeTag: NO,
      performance: false,
      globalProperties: {},
      optionMergeStrategies: {},
      errorHandler: undefined,
      warnHandler: undefined,
      compilerOptions: {},
    },
    mixins: [],
    components: {},
    directives: {},
    provides: Object.create(null),
    optionsCache: new WeakMap(),
    propsCache: new WeakMap(),
    emitsCache: new WeakMap(),
  }
}

export function normalizeEmitsOptions(
  comp: ConcreteComponent,
  appContext: AppContext,
  asMixin = false,
): ObjectEmitsOptions | null {
  const cache = appContext.emitsCache
  const cached = cache.get(comp)
  if (cached !== undefined) {
    return cached
  }

  const raw = comp.emits
  let normalized: ObjectEmitsOptions = {}

  // apply mixin/extends props
  let hasExtends = false
  if (__FEATURE_OPTIONS_API__ && !isFunction(comp)) {
    const extendEmits = (raw: ComponentOptions) => {
      const normalizedFromExtend = normalizeEmitsOptions(raw, appContext, true)
      if (normalizedFromExtend) {
        hasExtends = true
        extend(normalized, normalizedFromExtend)
      }
    }
    if (!asMixin && appContext.mixins.length) {
      appContext.mixins.forEach(extendEmits)
    }
    if (comp.extends) {
      extendEmits(comp.extends)
    }
    if (comp.mixins) {
      comp.mixins.forEach(extendEmits)
    }
  }

  if (!raw && !hasExtends) {
    if (isObject(comp)) {
      cache.set(comp, null)
    }
    return null
  }

  if (isArray(raw)) {
    raw.forEach(key => (normalized[key] = null))
  } else {
    extend(normalized, raw)
  }

  if (isObject(comp)) {
    cache.set(comp, normalized)
  }
  return normalized
}

function validatePropName(key: string) {
  if (key[0] !== '$' && !isReservedProp(key)) {
    return true
  } else if (__DEV__) {
    warn(`Invalid prop name: "${key}" is a reserved property.`)
  }
  return false
}

export function normalizePropsOptions(
  comp: ConcreteComponent,
  appContext: AppContext,
  asMixin = false,
): NormalizedPropsOptions {
  const cache =
    __FEATURE_OPTIONS_API__ && asMixin ? mixinPropsCache : appContext.propsCache
  const cached = cache.get(comp)
  if (cached) {
    return cached
  }

  const raw = comp.props
  const normalized: NormalizedPropsOptions[0] = {}
  const needCastKeys: NormalizedPropsOptions[1] = []

  // apply mixin/extends props
  let hasExtends = false
  if (__FEATURE_OPTIONS_API__ && !isFunction(comp)) {
    const extendProps = (raw: ComponentOptions) => {
      if (__COMPAT__ && isFunction(raw)) {
        raw = raw.options
      }
      hasExtends = true
      const [props, keys] = normalizePropsOptions(raw, appContext, true)
      extend(normalized, props)
      if (keys) needCastKeys.push(...keys)
    }
    if (!asMixin && appContext.mixins.length) {
      appContext.mixins.forEach(extendProps)
    }
    if (comp.extends) {
      extendProps(comp.extends)
    }
    if (comp.mixins) {
      comp.mixins.forEach(extendProps)
    }
  }

  if (!raw && !hasExtends) {
    if (isObject(comp)) {
      cache.set(comp, EMPTY_ARR as any)
    }
    return EMPTY_ARR as any
  }

  if (isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      if (__DEV__ && !isString(raw[i])) {
        warn(`props must be strings when using array syntax.`, raw[i])
      }
      const normalizedKey = camelize(raw[i])
      if (validatePropName(normalizedKey)) {
        normalized[normalizedKey] = EMPTY_OBJ
      }
    }
  } else if (raw) {
    if (__DEV__ && !isObject(raw)) {
      warn(`invalid props options`, raw)
    }
    for (const key in raw) {
      const normalizedKey = camelize(key)
      if (validatePropName(normalizedKey)) {
        const opt = raw[key]
        const prop: NormalizedProp = (normalized[normalizedKey] =
          isArray(opt) || isFunction(opt) ? { type: opt } : extend({}, opt))
        const propType = prop.type
        let shouldCast = false
        let shouldCastTrue = true

        if (isArray(propType)) {
          for (let index = 0; index < propType.length; ++index) {
            const type = propType[index]
            const typeName = isFunction(type) && type.name

            if (typeName === 'Boolean') {
              shouldCast = true
              break
            } else if (typeName === 'String') {
              // If we find `String` before `Boolean`, e.g. `[String, Boolean]`,
              // we need to handle the casting slightly differently. Props
              // passed as `<Comp checked="">` or `<Comp checked="checked">`
              // will either be treated as strings or converted to a boolean
              // `true`, depending on the order of the types.
              shouldCastTrue = false
            }
          }
        } else {
          shouldCast = isFunction(propType) && propType.name === 'Boolean'
        }

        prop[BooleanFlags.shouldCast] = shouldCast
        prop[BooleanFlags.shouldCastTrue] = shouldCastTrue
        // if the prop needs boolean casting or default value
        if (shouldCast || hasOwn(prop, 'default')) {
          needCastKeys.push(normalizedKey)
        }
      }
    }
  }

  const res: NormalizedPropsOptions = [normalized, needCastKeys]
  if (isObject(comp)) {
    cache.set(comp, res)
  }
  return res
}



const emptyAppContext = createAppContext()

export function createComponentInstance(
  vnode: VNode,
  parent: ComponentInternalInstance | null,
  suspense: SuspenseBoundary | null,
): ComponentInternalInstance {
  const type = vnode.type as ConcreteComponent
  // inherit parent app context - or - if root, adopt from root vnode
  const appContext =
    (parent ? parent.appContext : vnode.appContext) || emptyAppContext

  const instance: ComponentInternalInstance = {
    uid: uid++,
    vnode,
    type,
    parent,
    appContext,
    root: null!, // to be immediately set
    next: null,
    subTree: null!, // will be set synchronously right after creation
    effect: null!,
    update: null!, // will be set synchronously right after creation
    job: null!,
    scope: new EffectScope(true /* detached */),
    render: null,
    proxy: null,
    exposed: null,
    exposeProxy: null,
    withProxy: null,

    provides: parent ? parent.provides : Object.create(appContext.provides),
    ids: parent ? parent.ids : ['', 0, 0],
    accessCache: null!,
    renderCache: [],

    // local resolved assets
    components: null,
    directives: null,

    // resolved props and emits options
    propsOptions: normalizePropsOptions(type, appContext),
    emitsOptions: normalizeEmitsOptions(type, appContext),

    // emit
    emit: null!, // to be set immediately
    emitted: null,

    // props default value
    propsDefaults: EMPTY_OBJ,

    // inheritAttrs
    inheritAttrs: type.inheritAttrs,

    // state
    ctx: EMPTY_OBJ,
    data: EMPTY_OBJ,
    props: EMPTY_OBJ,
    attrs: EMPTY_OBJ,
    slots: EMPTY_OBJ,
    refs: EMPTY_OBJ,
    setupState: EMPTY_OBJ,
    setupContext: null,

    // suspense related
    suspense,
    suspenseId: suspense ? suspense.pendingId : 0,
    asyncDep: null,
    asyncResolved: false,

    // lifecycle hooks
    // not using enums here because it results in computed properties
    isMounted: false,
    isUnmounted: false,
    isDeactivated: false,
    bc: null,
    c: null,
    bm: null,
    m: null,
    bu: null,
    u: null,
    um: null,
    bum: null,
    da: null,
    a: null,
    rtg: null,
    rtc: null,
    ec: null,
    sp: null,
  }
  if (__DEV__) {
    instance.ctx = createDevRenderContext(instance)
  } else {
    instance.ctx = { _: instance }
  }
  instance.root = parent ? parent.root : instance
  instance.emit = emit.bind(null, instance)

  // apply custom element special handling
  if (vnode.ce) {
    vnode.ce(instance)
  }

  return instance
}


// Note: hydration is DOM-specific
// But we have to place it in core due to tight coupling with core - splitting
// it out creates a ton of unnecessary complexity.
// Hydration also depends on some renderer internal logic which needs to be
// passed in via arguments.
export function createHydrationFunctions(
  rendererInternals: RendererInternals<Node, Element>
): [
    RootHydrateFunction,
    (
      node: Node,
      vnode: VNode,
      parentComponent: ComponentInternalInstance | null,
      parentSuspense: SuspenseBoundary | null,
      slotScopeIds: string[] | null,
      optimized?: boolean
    ) => Node | null
  ] {
  const {
    mt: mountComponent,
    p: patch,
    o: {
      patchProp,
      createText,
      nextSibling,
      parentNode,
      remove,
      insert,
      createComment
    }
  } = rendererInternals

  const hydrate: RootHydrateFunction = (vnode, container) => {
    if (!container.hasChildNodes()) {
      ; (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
        warn(
          `Attempting to hydrate existing markup but container is empty. ` +
          `Performing full mount instead.`
        )
      patch(null, vnode, container)
      flushPostFlushCbs()
      container._vnode = vnode
      return
    }

    hydrateNode(container.firstChild!, vnode, null, null, null)
    flushPostFlushCbs()
    container._vnode = vnode
  }

  const hydrateNode = (
    node: Node,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    slotScopeIds: string[] | null,
    optimized = false
  ): Node | null => {
    optimized = optimized || !!vnode.dynamicChildren
    const isFragmentStart = isComment(node) && node.data === '['
    const onMismatch = () =>
      handleMismatch(
        node,
        vnode,
        parentComponent,
        parentSuspense,
        slotScopeIds,
        isFragmentStart
      )

    const { type, ref, shapeFlag, patchFlag } = vnode
    let domType = node.nodeType
    vnode.el = node

    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      def(node, '__vnode', vnode, true)
      def(node, '__vueParentComponent', parentComponent, true)
    }

    if (patchFlag === PatchFlags.BAIL) {
      optimized = false
      vnode.dynamicChildren = null
    }

    let nextNode: Node | null = null
    switch (type) {
      case Text:
        if (domType !== DOMNodeTypes.TEXT) {
          // #5728 empty text node inside a slot can cause hydration failure
          // because the server rendered HTML won't contain a text node
          if (vnode.children === '') {
            insert((vnode.el = createText('')), parentNode(node)!, node)
            nextNode = node
          } else {
            nextNode = onMismatch()
          }
        } else {
          if ((node as Text).data !== vnode.children) {
            ; (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
              warn(
                `Hydration text mismatch in`,
                node.parentNode,
                `\n  - rendered on server: ${JSON.stringify(
                  (node as Text).data
                )}` +
                `\n  - expected on client: ${JSON.stringify(vnode.children)}`
              )
            logMismatchError()
              ; (node as Text).data = vnode.children as string
          }
          nextNode = nextSibling(node)
        }
        break
      case Comment:
        if (isTemplateNode(node)) {
          nextNode = nextSibling(node)
          // wrapped <transition appear>
          // replace <template> node with inner child
          replaceNode(
            (vnode.el = node.content.firstChild!),
            node,
            parentComponent
          )
        } else if (domType !== DOMNodeTypes.COMMENT || isFragmentStart) {
          nextNode = onMismatch()
        } else {
          nextNode = nextSibling(node)
        }
        break
      case Static:
        if (isFragmentStart) {
          // entire template is static but SSRed as a fragment
          node = nextSibling(node)!
          domType = node.nodeType
        }
        if (domType === DOMNodeTypes.ELEMENT || domType === DOMNodeTypes.TEXT) {
          // determine anchor, adopt content
          nextNode = node
          // if the static vnode has its content stripped during build,
          // adopt it from the server-rendered HTML.
          const needToAdoptContent = !(vnode.children as string).length
          for (let i = 0; i < vnode.staticCount!; i++) {
            if (needToAdoptContent)
              vnode.children +=
                nextNode.nodeType === DOMNodeTypes.ELEMENT
                  ? (nextNode as Element).outerHTML
                  : (nextNode as Text).data
            if (i === vnode.staticCount! - 1) {
              vnode.anchor = nextNode
            }
            nextNode = nextSibling(nextNode)!
          }
          return isFragmentStart ? nextSibling(nextNode) : nextNode
        } else {
          onMismatch()
        }
        break
      case Fragment:
        if (!isFragmentStart) {
          nextNode = onMismatch()
        } else {
          nextNode = hydrateFragment(
            node as Comment,
            vnode,
            parentComponent,
            parentSuspense,
            slotScopeIds,
            optimized
          )
        }
        break
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          if (
            (domType !== DOMNodeTypes.ELEMENT ||
              (vnode.type as string).toLowerCase() !==
              (node as Element).tagName.toLowerCase()) &&
            !isTemplateNode(node)
          ) {
            nextNode = onMismatch()
          } else {
            nextNode = hydrateElement(
              node as Element,
              vnode,
              parentComponent,
              parentSuspense,
              slotScopeIds,
              optimized
            )
          }
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // when setting up the render effect, if the initial vnode already
          // has .el set, the component will perform hydration instead of mount
          // on its sub-tree.
          vnode.slotScopeIds = slotScopeIds
          const container = parentNode(node)!

          // Locate the next node.
          if (isFragmentStart) {
            // If it's a fragment: since components may be async, we cannot rely
            // on component's rendered output to determine the end of the
            // fragment. Instead, we do a lookahead to find the end anchor node.
            nextNode = locateClosingAnchor(node)
          } else if (isComment(node) && node.data === 'teleport start') {
            // #4293 #6152
            // If a teleport is at component root, look ahead for teleport end.
            nextNode = locateClosingAnchor(node, node.data, 'teleport end')
          } else {
            nextNode = nextSibling(node)
          }

          mountComponent(
            vnode,
            container,
            null,
            parentComponent,
            parentSuspense,
            getContainerType(container),
            optimized
          )

          // #3787
          // if component is async, it may get moved / unmounted before its
          // inner component is loaded, so we need to give it a placeholder
          // vnode that matches its adopted DOM.
          if (
            isAsyncWrapper(vnode) &&
            !(vnode.type as ComponentOptions).__asyncResolved
          ) {
            let subTree
            if (isFragmentStart) {

              subTree = createVNode(Fragment)
              subTree.anchor = nextNode
                ? nextNode.previousSibling
                : container.lastChild
            } else {

              subTree =
                node.nodeType === 3 ? createTextVNode('') : createVNode('div')
            }
            subTree.el = node
            vnode.component!.subTree = subTree
          }
        } else if (shapeFlag & ShapeFlags.TELEPORT) {
          if (domType !== DOMNodeTypes.COMMENT) {
            nextNode = onMismatch()
          } else {
            nextNode = (vnode.type as typeof TeleportImpl).hydrate(
              node,
              vnode as TeleportVNode,
              parentComponent,
              parentSuspense,
              slotScopeIds,
              optimized,
              rendererInternals,
              hydrateChildren
            )
          }
        } else if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
          nextNode = (vnode.type as typeof SuspenseImpl).hydrate(
            node,
            vnode,
            parentComponent,
            parentSuspense,
            getContainerType(parentNode(node)!),
            slotScopeIds,
            optimized,
            rendererInternals,
            hydrateNode
          )
        } else if (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) {
          warn('Invalid HostVNode type:', type, `(${typeof type})`)
        }
    }

    if (ref != null) {
      setRef(ref, null, parentSuspense, vnode)
    }

    return nextNode
  }

  const hydrateElement = (
    el: Element,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    slotScopeIds: string[] | null,
    optimized: boolean
  ) => {
    optimized = optimized || !!vnode.dynamicChildren
    const { type, props, patchFlag, shapeFlag, dirs, transition } = vnode
    // #4006 for form elements with non-string v-model value bindings
    // e.g. <option :value="obj">, <input type="checkbox" :true-value="1">
    // #7476 <input indeterminate>
    const forcePatch = type === 'input' || type === 'option'
    // skip props & children if this is hoisted static nodes
    // #5405 in dev, always hydrate children for HMR
    if (__DEV__ || forcePatch || patchFlag !== PatchFlags.CACHED) {
      if (dirs) {
        invokeDirectiveHook(vnode, null, parentComponent, 'created')
      }

      // handle appear transition
      let needCallTransitionHooks = false
      if (isTemplateNode(el)) {
        needCallTransitionHooks =
          needTransition(
            null, // no need check parentSuspense in hydration
            transition
          ) &&
          parentComponent &&
          parentComponent.vnode.props &&
          parentComponent.vnode.props.appear

        const content = (el as HTMLTemplateElement).content
          .firstChild as Element & { $cls?: string }

        if (needCallTransitionHooks) {
          const cls = content.getAttribute('class')
          if (cls) content.$cls = cls
          transition!.beforeEnter(content)
        }

        // replace <template> node with inner children
        replaceNode(content, el, parentComponent)
        vnode.el = el = content
      }

      // children
      if (
        shapeFlag & ShapeFlags.ARRAY_CHILDREN &&
        // skip if element has innerHTML / textContent
        !(props && (props.innerHTML || props.textContent))
      ) {
        let next = hydrateChildren(
          el.firstChild,
          vnode,
          el,
          parentComponent,
          parentSuspense,
          slotScopeIds,
          optimized
        )
        let hasWarned = false
        while (next) {
          if (!isMismatchAllowed(el, MismatchTypes.CHILDREN)) {
            if (
              (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
              !hasWarned
            ) {
              warn(
                `Hydration children mismatch on`,
                el,
                `\nServer rendered element contains more child nodes than client vdom.`
              )
              hasWarned = true
            }
            logMismatchError()
          }

          // The SSRed DOM contains more nodes than it should. Remove them.
          const cur = next
          next = next.nextSibling
          remove(cur)
        }
      } else if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
        // #11873 the HTML parser will "eat" the first newline when parsing
        // <pre> and <textarea>, so if the client value starts with a newline,
        // we need to remove it before comparing
        let clientText = vnode.children as string
        if (
          clientText[0] === '\n' &&
          (el.tagName === 'PRE' || el.tagName === 'TEXTAREA')
        ) {
          clientText = clientText.slice(1)
        }
        if (el.textContent !== clientText) {
          if (!isMismatchAllowed(el, MismatchTypes.TEXT)) {
            ; (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
              warn(
                `Hydration text content mismatch on`,
                el,
                `\n  - rendered on server: ${el.textContent}` +
                `\n  - expected on client: ${vnode.children as string}`
              )
            logMismatchError()
          }

          el.textContent = vnode.children as string
        }
      }

      // props
      if (props) {
        if (
          __DEV__ ||
          __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__ ||
          forcePatch ||
          !optimized ||
          patchFlag & (PatchFlags.FULL_PROPS | PatchFlags.NEED_HYDRATION)
        ) {
          const isCustomElement = el.tagName.includes('-')
          for (const key in props) {
            // check hydration mismatch
            if (
              (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
              // #11189 skip if this node has directives that have created hooks
              // as it could have mutated the DOM in any possible way
              !(dirs && dirs.some(d => d.dir.created)) &&
              propHasMismatch(el, key, props[key], vnode, parentComponent)
            ) {
              logMismatchError()
            }
            if (
              (forcePatch &&
                (key.endsWith('value') || key === 'indeterminate')) ||
              (isOn(key) && !isReservedProp(key)) ||
              // force hydrate v-bind with .prop modifiers
              key[0] === '.' ||
              isCustomElement
            ) {
              patchProp(el, key, null, props[key], undefined, parentComponent)
            }
          }
        } else if (props.onClick) {
          // Fast path for click listeners (which is most often) to avoid
          // iterating through props.
          patchProp(
            el,
            'onClick',
            null,
            props.onClick,
            undefined,
            parentComponent
          )
        } else if (patchFlag & PatchFlags.STYLE && isReactive(props.style)) {
          // #11372: object style values are iterated during patch instead of
          // render/normalization phase, but style patch is skipped during
          // hydration, so we need to force iterate the object to track deps
          for (const key in props.style) props.style[key]
        }
      }

      // vnode / directive hooks
      let vnodeHooks: VNodeHook | null | undefined
      if ((vnodeHooks = props && props.onVnodeBeforeMount)) {
        invokeVNodeHook(vnodeHooks, parentComponent, vnode)
      }
      if (dirs) {
        invokeDirectiveHook(vnode, null, parentComponent, 'beforeMount')
      }
      if (
        (vnodeHooks = props && props.onVnodeMounted) ||
        dirs ||
        needCallTransitionHooks
      ) {
        queueEffectWithSuspense(() => {
          vnodeHooks && invokeVNodeHook(vnodeHooks, parentComponent, vnode)
          needCallTransitionHooks && transition!.enter(el)
          dirs && invokeDirectiveHook(vnode, null, parentComponent, 'mounted')
        }, parentSuspense)
      }
    }

    return el.nextSibling
  }

  const hydrateChildren = (
    node: Node | null,
    parentVNode: VNode,
    container: Element,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    slotScopeIds: string[] | null,
    optimized: boolean
  ): Node | null => {
    optimized = optimized || !!parentVNode.dynamicChildren
    const children = parentVNode.children as VNode[]
    const l = children.length
    let hasWarned = false
    for (let i = 0; i < l; i++) {
      const vnode = optimized
        ? children[i]
        : (children[i] = normalizeVNode(children[i]))
      const isText = vnode.type === Text
      if (node) {
        if (isText && !optimized) {
          // #7285 possible consecutive text vnodes from manual render fns or
          // JSX-compiled fns, but on the client the browser parses only 1 text
          // node.
          // look ahead for next possible text vnode
          if (i + 1 < l && normalizeVNode(children[i + 1]).type === Text) {
            // create an extra TextNode on the client for the next vnode to
            // adopt
            insert(
              createText(
                (node as Text).data.slice((vnode.children as string).length)
              ),
              container,
              nextSibling(node)
            )
              ; (node as Text).data = vnode.children as string
          }
        }
        node = hydrateNode(
          node,
          vnode,
          parentComponent,
          parentSuspense,
          slotScopeIds,
          optimized
        )
      } else if (isText && !vnode.children) {
        // #7215 create a TextNode for empty text node
        // because server rendered HTML won't contain a text node
        insert((vnode.el = createText('')), container)
      } else {
        if (!isMismatchAllowed(container, MismatchTypes.CHILDREN)) {
          if (
            (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
            !hasWarned
          ) {
            warn(
              `Hydration children mismatch on`,
              container,
              `\nServer rendered element contains fewer child nodes than client vdom.`
            )
            hasWarned = true
          }
          logMismatchError()
        }

        // the SSRed DOM didn't contain enough nodes. Mount the missing ones.
        patch(
          null,
          vnode,
          container,
          null,
          parentComponent,
          parentSuspense,
          getContainerType(container),
          slotScopeIds
        )
      }
    }
    return node
  }

  const hydrateFragment = (
    node: Comment,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    slotScopeIds: string[] | null,
    optimized: boolean
  ) => {
    const { slotScopeIds: fragmentSlotScopeIds } = vnode
    if (fragmentSlotScopeIds) {
      slotScopeIds = slotScopeIds
        ? slotScopeIds.concat(fragmentSlotScopeIds)
        : fragmentSlotScopeIds
    }

    const container = parentNode(node)!
    const next = hydrateChildren(
      nextSibling(node)!,
      vnode,
      container,
      parentComponent,
      parentSuspense,
      slotScopeIds,
      optimized
    )
    if (next && isComment(next) && next.data === ']') {
      return nextSibling((vnode.anchor = next))
    } else {
      // fragment didn't hydrate successfully, since we didn't get a end anchor
      // back. This should have led to node/children mismatch warnings.
      logMismatchError()

      // since the anchor is missing, we need to create one and insert it
      insert((vnode.anchor = createComment(`]`)), container, next)
      return next
    }
  }

  const handleMismatch = (
    node: Node,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    slotScopeIds: string[] | null,
    isFragment: boolean
  ): Node | null => {
    if (!isMismatchAllowed(node.parentElement!, MismatchTypes.CHILDREN)) {
      ; (__DEV__ || __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__) &&
        warn(
          `Hydration node mismatch:\n- rendered on server:`,
          node,
          node.nodeType === DOMNodeTypes.TEXT
            ? `(text)`
            : isComment(node) && node.data === '['
              ? `(start of fragment)`
              : ``,
          `\n- expected on client:`,
          vnode.type
        )
      logMismatchError()
    }

    vnode.el = null

    if (isFragment) {
      // remove excessive fragment nodes
      const end = locateClosingAnchor(node)
      while (true) {
        const next = nextSibling(node)
        if (next && next !== end) {
          remove(next)
        } else {
          break
        }
      }
    }

    const next = nextSibling(node)
    const container = parentNode(node)!
    remove(node)

    patch(
      null,
      vnode,
      container,
      next,
      parentComponent,
      parentSuspense,
      getContainerType(container),
      slotScopeIds
    )
    // the component vnode's el should be updated when a mismatch occurs.
    if (parentComponent) {
      parentComponent.vnode.el = vnode.el
      updateHOCHostEl(parentComponent, vnode.el)
    }
    return next
  }

  // looks ahead for a start and closing comment node
  const locateClosingAnchor = (
    node: Node | null,
    open = '[',
    close = ']'
  ): Node | null => {
    let match = 0
    while (node) {
      node = nextSibling(node)
      if (node && isComment(node)) {
        if (node.data === open) match++
        if (node.data === close) {
          if (match === 0) {
            return nextSibling(node)
          } else {
            match--
          }
        }
      }
    }
    return node
  }

  const replaceNode = (
    newNode: Node,
    oldNode: Node,
    parentComponent: ComponentInternalInstance | null
  ): void => {
    // replace node
    const parentNode = oldNode.parentNode
    if (parentNode) {
      parentNode.replaceChild(newNode, oldNode)
    }

    // update vnode
    let parent = parentComponent
    while (parent) {
      if (parent.vnode.el === oldNode) {
        parent.vnode.el = parent.subTree.el = newNode
      }
      parent = parent.parent
    }
  }

  const isTemplateNode = (node: Node): node is HTMLTemplateElement => {
    return (
      node.nodeType === DOMNodeTypes.ELEMENT &&
      (node as Element).tagName === 'TEMPLATE'
    )
  }

  return [hydrate, hydrateNode]
}


/**** is* function ***/
export const isKeepAlive = (vnode: VNode): boolean =>
  (vnode.type as any).__isKeepAlive

export const isComment = (node: Node): node is Comment =>
  node.nodeType === DOMNodeTypes.COMMENT

export const isAsyncWrapper = (i: ComponentInternalInstance | VNode): boolean =>
  !!(i.type as ComponentOptions).__asyncLoader

function isMismatchAllowed(
  el: Element | null,
  allowedType: MismatchTypes,
): boolean {
  if (
    allowedType === MismatchTypes.TEXT ||
    allowedType === MismatchTypes.CHILDREN
  ) {
    while (el && !el.hasAttribute(allowMismatchAttr)) {
      el = el.parentElement
    }
  }
  const allowedAttr = el && el.getAttribute(allowMismatchAttr)
  if (allowedAttr == null) {
    return false
  } else if (allowedAttr === '') {
    return true
  } else {
    const list = allowedAttr.split(',')
    // text is a subset of children
    if (allowedType === MismatchTypes.TEXT && list.includes('children')) {
      return true
    }
    return list.includes(MismatchTypeString[allowedType])
  }
}
export function isVNode(value: any): value is VNode {
  return value ? value.__v_isVNode === true : false
}
export function isCompatEnabled(
  key: DeprecationTypes,
  instance: ComponentInternalInstance | null,
  enableForBuiltIn = false,
): boolean {
  // skip compat for built-in components
  if (!enableForBuiltIn && instance && instance.type.__isBuiltIn) {
    return false
  }

  const rawMode = getCompatConfigForKey('MODE', instance) || 2
  const val = getCompatConfigForKey(key, instance)

  const mode = isFunction(rawMode)
    ? rawMode(instance && instance.type)
    : rawMode

  if (mode === 2) {
    return val !== false
  } else {
    return val === true || val === 'suppress-warning'
  }
}

/**
 * Shared between server-renderer and runtime-core hydration logic
 */
export function isRenderableAttrValue(value: unknown): boolean {
  if (value == null) {
    return false
  }
  const type = typeof value
  return type === 'string' || type === 'number' || type === 'boolean'
}


export function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  if (__DEV__ && n2.shapeFlag & ShapeFlags.COMPONENT && n1.component) {
    const dirtyInstances = hmrDirtyComponents.get(n2.type as ConcreteComponent)
    if (dirtyInstances && dirtyInstances.has(n1.component)) {
      // #7042, ensure the vnode being unmounted during HMR
      // bitwise operations to remove keep alive flags
      n1.shapeFlag &= ~ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
      n2.shapeFlag &= ~ShapeFlags.COMPONENT_KEPT_ALIVE
      // HMR only: if the component has been hot-updated, force a reload.
      return false
    }
  }
  return n1.type === n2.type && n1.key === n2.key
}

export function isStatefulComponent(
  instance: ComponentInternalInstance,
): number {
  return instance.vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT
}

const isSVGContainer = (container: Element) =>
  container.namespaceURI!.includes('svg') &&
  container.tagName !== 'foreignObject'

const isMathMLContainer = (container: Element) =>
  container.namespaceURI!.includes('MathML')

const isTeleportDisabled = (props: VNode['props']): boolean =>
  props && (props.disabled || props.disabled === '')

export const isTeleport = (type: any): boolean => type.__isTeleport

const isTargetSVG = (target: RendererElement): boolean =>
  typeof SVGElement !== 'undefined' && target instanceof SVGElement

const isTargetMathML = (target: RendererElement): boolean =>
  typeof MathMLElement === 'function' && target instanceof MathMLElement

const isTeleportDeferred = (props: VNode['props']): boolean =>
  props && (props.defer || props.defer === '')


function isSetEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false
  }
  for (const s of a) {
    if (!b.has(s)) {
      return false
    }
  }
  return true
}

function updateCssVars(vnode: VNode, isDisabled: boolean) {
  // presence of .ut method indicates owner component uses css vars.
  // code path here can assume browser environment.
  const ctx = vnode.ctx
  if (ctx && ctx.ut) {
    let node, anchor
    if (isDisabled) {
      node = vnode.el
      anchor = vnode.anchor
    } else {
      node = vnode.targetStart
      anchor = vnode.targetAnchor
    }
    while (node && node !== anchor) {
      if (node.nodeType === 1) node.setAttribute('data-v-owner', ctx.uid)
      node = node.nextSibling
    }
    ctx.ut()
  }
}

const resolveTarget = <T = RendererElement>(
  props: TeleportProps | null,
  select: RendererOptions['querySelector'],
): T | null => {
  const targetSelector = props && props.to
  if (isString(targetSelector)) {
    if (!select) {
      __DEV__ &&
        warn(
          `Current renderer does not support string target for Teleports. ` +
          `(missing querySelector renderer option)`,
        )
      return null
    } else {
      const target = select(targetSelector)
      if (__DEV__ && !target && !isTeleportDisabled(props)) {
        warn(
          `Failed to locate Teleport target with selector "${targetSelector}". ` +
          `Note the target element must exist before the component is mounted - ` +
          `i.e. the target cannot be rendered by the component itself, and ` +
          `ideally should be outside of the entire Vue component tree.`,
        )
      }
      return target as T
    }
  } else {
    if (__DEV__ && !targetSelector && !isTeleportDisabled(props)) {
      warn(`Invalid Teleport target: ${targetSelector}`)
    }
    return targetSelector as T
  }
}

export function getCompatConfigForKey(
  key: DeprecationTypes | 'MODE',
  instance: ComponentInternalInstance | null,
): CompatConfig[DeprecationTypes | 'MODE'] {
  const instanceConfig =
    instance && (instance.type as ComponentOptions).compatConfig
  if (instanceConfig && key in instanceConfig) {
    return instanceConfig[key]
  }
  return globalCompatConfig[key]
}

export function normalizeVNode(child: VNodeChild): VNode {
  if (child == null || typeof child === 'boolean') {
    // empty placeholder

    return createVNode(Comment)
  } else if (isArray(child)) {

    // fragment
    return createVNode(
      Fragment,
      null,
      // #3666, avoid reference pollution when reusing vnode
      child.slice(),
    )
  } else if (isVNode(child)) {
    // already vnode, this should be the most common since compiled templates
    // always produce all-vnode children arrays
    return cloneIfMounted(child)
  } else {


    // strings and numbers
    return createVNode(Text, null, String(child))
  }
}

export function invokeVNodeHook(
  hook: VNodeHook,
  instance: ComponentInternalInstance | null,
  vnode: VNode,
  prevVNode: VNode | null = null,
): void {
  callWithAsyncErrorHandling(hook, instance, ErrorCodes.VNODE_HOOK, [
    vnode,
    prevVNode,
  ])
}

const getContainerType = (
  container: Element | ShadowRoot,
): 'svg' | 'mathml' | undefined => {
  if (container.nodeType !== DOMNodeTypes.ELEMENT) return undefined
  if (isSVGContainer(container as Element)) return 'svg'
  if (isMathMLContainer(container as Element)) return 'mathml'
  return undefined
}

const logMismatchError = () => {
  if (__TEST__ || hasLoggedMismatchError) {
    return
  }
  // this error should show up in production
  console.error('Hydration completed but contains mismatches.')
  hasLoggedMismatchError = true
}

export const isReservedProp: (key: string) => boolean = /*@__PURE__*/ makeMap(
  // the leading comma is intentional so empty string "" is also included
  ',key,ref,ref_for,ref_key,' +
  'onVnodeBeforeMount,onVnodeMounted,' +
  'onVnodeBeforeUpdate,onVnodeUpdated,' +
  'onVnodeBeforeUnmount,onVnodeUnmounted',
)

export function cloneIfMounted(child: VNode): VNode {
  return (child.el === null && child.patchFlag !== PatchFlags.CACHED) ||
    child.memo
    ? child
    : cloneVNode(child)
}

const normalizeRef = ({
  ref,
  ref_key,
  ref_for,
}: VNodeProps): VNodeNormalizedRefAtom | null => {
  if (typeof ref === 'number') {
    ref = '' + ref
  }
  return (
    ref != null
      ? isString(ref) || isRef(ref) || isFunction(ref)
        ? { i: currentRenderingInstance, r: ref, k: ref_key, f: !!ref_for }
        : ref
      : null
  ) as any
}
export function cloneVNode<T, U>(
  vnode: VNode<T, U>,
  extraProps?: (Data & VNodeProps) | null,
  mergeRef = false,
  cloneTransition = false,
): VNode<T, U> {
  // This is intentionally NOT using spread or extend to avoid the runtime
  // key enumeration cost.
  const { props, ref, patchFlag, children, transition } = vnode
  const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props
  const cloned: VNode<T, U> = {
    __v_isVNode: true,
    __v_skip: true,
    type: vnode.type,
    props: mergedProps,
    key: mergedProps && normalizeKey(mergedProps),
    ref:
      extraProps && extraProps.ref
        ? // #2078 in the case of <component :is="vnode" ref="extra"/>
        // if the vnode itself already has a ref, cloneVNode will need to merge
        // the refs so the single vnode can be set on multiple refs
        mergeRef && ref
          ? isArray(ref)
            ? ref.concat(normalizeRef(extraProps)!)
            : [ref, normalizeRef(extraProps)!]
          : normalizeRef(extraProps)
        : ref,
    scopeId: vnode.scopeId,
    slotScopeIds: vnode.slotScopeIds,
    children:
      __DEV__ && patchFlag === PatchFlags.CACHED && isArray(children)
        ? (children as VNode[]).map(deepCloneVNode)
        : children,
    target: vnode.target,
    targetStart: vnode.targetStart,
    targetAnchor: vnode.targetAnchor,
    staticCount: vnode.staticCount,
    shapeFlag: vnode.shapeFlag,
    // if the vnode is cloned with extra props, we can no longer assume its
    // existing patch flag to be reliable and need to add the FULL_PROPS flag.
    // note: preserve flag for fragments since they use the flag for children
    // fast paths only.
    patchFlag:
      extraProps && vnode.type !== Fragment
        ? patchFlag === PatchFlags.CACHED // hoisted node
          ? PatchFlags.FULL_PROPS
          : patchFlag | PatchFlags.FULL_PROPS
        : patchFlag,
    dynamicProps: vnode.dynamicProps,
    dynamicChildren: vnode.dynamicChildren,
    appContext: vnode.appContext,
    dirs: vnode.dirs,
    transition,

    // These should technically only be non-null on mounted VNodes. However,
    // they *should* be copied for kept-alive vnodes. So we just always copy
    // them since them being non-null during a mount doesn't affect the logic as
    // they will simply be overwritten.
    component: vnode.component,
    suspense: vnode.suspense,
    ssContent: vnode.ssContent && cloneVNode(vnode.ssContent),
    ssFallback: vnode.ssFallback && cloneVNode(vnode.ssFallback),
    placeholder: vnode.placeholder,

    el: vnode.el,
    anchor: vnode.anchor,
    ctx: vnode.ctx,
    ce: vnode.ce,
  }

  // if the vnode will be replaced by the cloned one, it is necessary
  // to clone the transition to ensure that the vnode referenced within
  // the transition hooks is fresh.
  if (transition && cloneTransition) {
    setTransitionHooks(
      cloned as VNode,
      transition.clone(cloned as VNode) as TransitionHooks,
    )
  }

  if (__COMPAT__) {
    defineLegacyVNodeProperties(cloned as VNode)
  }

  return cloned
}

export function setTransitionHooks(vnode: VNode, hooks: TransitionHooks): void {
  if (vnode.shapeFlag & ShapeFlags.COMPONENT && vnode.component) {
    vnode.transition = hooks
    setTransitionHooks(vnode.component.subTree, hooks)
  } else if (__FEATURE_SUSPENSE__ && vnode.shapeFlag & ShapeFlags.SUSPENSE) {
    vnode.ssContent!.transition = hooks.clone(vnode.ssContent!)
    vnode.ssFallback!.transition = hooks.clone(vnode.ssFallback!)
  } else {
    vnode.transition = hooks
  }
}

export function defineLegacyVNodeProperties(vnode: VNode): void {
  /* v8 ignore start */
  if (
    isCompatEnabled(
      DeprecationTypes.RENDER_FUNCTION,
      currentRenderingInstance,
      true /* enable for built-ins */,
    ) &&
    isCompatEnabled(
      DeprecationTypes.PRIVATE_APIS,
      currentRenderingInstance,
      true /* enable for built-ins */,
    )
  ) {
    const context = currentRenderingInstance
    const getInstance = () => vnode.component && vnode.component.proxy
    let componentOptions: any
    Object.defineProperties(vnode, {
      tag: { get: () => vnode.type },
      data: { get: () => vnode.props || {}, set: p => (vnode.props = p) },
      elm: { get: () => vnode.el },
      componentInstance: { get: getInstance },
      child: { get: getInstance },
      text: { get: () => (isString(vnode.children) ? vnode.children : null) },
      context: { get: () => context && context.proxy },
      componentOptions: {
        get: () => {
          if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
            if (componentOptions) {
              return componentOptions
            }
            return (componentOptions = {
              Ctor: vnode.type,
              propsData: vnode.props,
              children: vnode.children,
            })
          }
        },
      },
    })
  }
  /* v8 ignore stop */
}


export function invalidateMount(hooks: LifecycleHook): void {
  if (hooks) {
    for (let i = 0; i < hooks.length; i++)
      hooks[i].flags! |= SchedulerJobFlags.DISPOSED
  }
}

export const queuePostRenderEffect: (
  fn: SchedulerJobs,
  suspense: SuspenseBoundary | null,
) => void = __FEATURE_SUSPENSE__
    ? __TEST__
      ? // vitest can't seem to handle eager circular dependency
      (fn: Function | Function[], suspense: SuspenseBoundary | null) =>
        queueEffectWithSuspense(fn, suspense)
      : queueEffectWithSuspense
    : queuePostFlushCb

function isMapEqual(a: Map<string, string>, b: Map<string, string>): boolean {
  if (a.size !== b.size) {
    return false
  }
  for (const [key, value] of a) {
    if (value !== b.get(key)) {
      return false
    }
  }
  return true
}

function toStyleMap(str: string): Map<string, string> {
  const styleMap: Map<string, string> = new Map()
  for (const item of str.split(';')) {
    let [key, value] = item.split(':')
    key = key.trim()
    value = value && value.trim()
    if (key && value) {
      styleMap.set(key, value)
    }
  }
  return styleMap
}

function resolveCssVars(
  instance: ComponentInternalInstance,
  vnode: VNode,
  expectedMap: Map<string, string>,
) {
  const root = instance.subTree
  if (
    instance.getCssVars &&
    (vnode === root ||
      (root &&
        root.type === Fragment &&
        (root.children as VNode[]).includes(vnode)))
  ) {
    const cssVars = instance.getCssVars()
    for (const key in cssVars) {
      const value = normalizeCssVarValue(cssVars[key])
      expectedMap.set(`--${getEscapedCssVarName(key, false)}`, value)
    }
  }
  if (vnode === root && instance.parent) {
    resolveCssVars(instance.parent, instance.vnode, expectedMap)
  }
}


/**
 * Dev only
 */
function propHasMismatch(
  el: Element & { $cls?: string },
  key: string,
  clientValue: any,
  vnode: VNode,
  instance: ComponentInternalInstance | null,
): boolean {
  let mismatchType: MismatchTypes | undefined
  let mismatchKey: string | undefined
  let actual: string | boolean | null | undefined
  let expected: string | boolean | null | undefined
  if (key === 'class') {
    // classes might be in different order, but that doesn't affect cascade
    // so we just need to check if the class lists contain the same classes.
    if (el.$cls) {
      actual = el.$cls
      delete el.$cls
    } else {
      actual = el.getAttribute('class')
    }
    expected = normalizeClass(clientValue)
    if (!isSetEqual(toClassSet(actual || ''), toClassSet(expected))) {
      mismatchType = MismatchTypes.CLASS
      mismatchKey = `class`
    }
  } else if (key === 'style') {
    // style might be in different order, but that doesn't affect cascade
    actual = el.getAttribute('style') || ''
    expected = isString(clientValue)
      ? clientValue
      : stringifyStyle(normalizeStyle(clientValue))
    const actualMap = toStyleMap(actual)
    const expectedMap = toStyleMap(expected)
    // If `v-show=false`, `display: 'none'` should be added to expected
    if (vnode.dirs) {
      for (const { dir, value } of vnode.dirs) {
        // @ts-expect-error only vShow has this internal name
        if (dir.name === 'show' && !value) {
          expectedMap.set('display', 'none')
        }
      }
    }

    if (instance) {
      resolveCssVars(instance, vnode, expectedMap)
    }

    if (!isMapEqual(actualMap, expectedMap)) {
      mismatchType = MismatchTypes.STYLE
      mismatchKey = 'style'
    }
  } else if (
    (el instanceof SVGElement && isKnownSvgAttr(key)) ||
    (el instanceof HTMLElement && (isBooleanAttr(key) || isKnownHtmlAttr(key)))
  ) {
    if (isBooleanAttr(key)) {
      actual = el.hasAttribute(key)
      expected = includeBooleanAttr(clientValue)
    } else if (clientValue == null) {
      actual = el.hasAttribute(key)
      expected = false
    } else {
      if (el.hasAttribute(key)) {
        actual = el.getAttribute(key)
      } else if (key === 'value' && el.tagName === 'TEXTAREA') {
        // #10000 textarea.value can't be retrieved by `hasAttribute`
        actual = (el as HTMLTextAreaElement).value
      } else {
        actual = false
      }
      expected = isRenderableAttrValue(clientValue)
        ? String(clientValue)
        : false
    }
    if (actual !== expected) {
      mismatchType = MismatchTypes.ATTRIBUTE
      mismatchKey = key
    }
  }

  if (mismatchType != null && !isMismatchAllowed(el, mismatchType)) {
    const format = (v: any) =>
      v === false ? `(not rendered)` : `${mismatchKey}="${v}"`
    const preSegment = `Hydration ${MismatchTypeString[mismatchType]} mismatch on`
    const postSegment =
      `\n  - rendered on server: ${format(actual)}` +
      `\n  - expected on client: ${format(expected)}` +
      `\n  Note: this mismatch is check-only. The DOM will not be rectified ` +
      `in production due to performance overhead.` +
      `\n  You should fix the source of the mismatch.`
    if (__TEST__) {
      // during tests, log the full message in one single string for easier
      // debugging.
      warn(`${preSegment} ${el.tagName}${postSegment}`)
    } else {
      warn(preSegment, el, postSegment)
    }
    return true
  }
  return false
}

export const isSuspense = (type: any): boolean => type.__isSuspense

// Check if an incoming prop key is a declared emit event listener.
// e.g. With `emits: { click: null }`, props named `onClick` and `onclick` are
// both considered matched listeners.
export function isEmitListener(
  options: ObjectEmitsOptions | null,
  key: string,
): boolean {
  if (!options || !isOn(key)) {
    return false
  }

  if (__COMPAT__ && key.startsWith(compatModelEventPrefix)) {
    return true
  }

  key = key.slice(2).replace(/Once$/, '')
  return (
    hasOwn(options, key[0].toLowerCase() + key.slice(1)) ||
    hasOwn(options, hyphenate(key)) ||
    hasOwn(options, key)
  )
}

export const createInternalObject = (): any =>
  Object.create(internalObjectProto)


export function isClassComponent(value: unknown): value is ClassComponent {
  return isFunction(value) && '__vccOpts' in value
}

export const isInternalObject = (obj: object): boolean =>
  Object.getPrototypeOf(obj) === internalObjectProto


export function guardReactiveProps(
  props: (Data & VNodeProps) | null,
): (Data & VNodeProps) | null {
  if (!props) return null
  return isProxy(props) || isInternalObject(props) ? extend({}, props) : props
}


function _createVNode(
  type: VNodeTypes | ClassComponent | typeof NULL_DYNAMIC_COMPONENT,
  props: (Data & VNodeProps) | null = null,
  children: unknown = null,
  patchFlag: number = 0,
  dynamicProps: string[] | null = null,
  isBlockNode = false,
): VNode {
  if (!type || type === NULL_DYNAMIC_COMPONENT) {
    if (__DEV__ && !type) {
      warn(`Invalid vnode type when creating vnode: ${type}.`)
    }

    type = Comment
  }

  if (isVNode(type)) {
    // createVNode receiving an existing vnode. This happens in cases like
    // <component :is="vnode"/>
    // #2078 make sure to merge refs during the clone instead of overwriting it
    const cloned = cloneVNode(type, props, true /* mergeRef: true */)
    if (children) {
      normalizeChildren(cloned, children)
    }
    if (isBlockTreeEnabled > 0 && !isBlockNode && currentBlock) {
      if (cloned.shapeFlag & ShapeFlags.COMPONENT) {
        currentBlock[currentBlock.indexOf(type)] = cloned
      } else {
        currentBlock.push(cloned)
      }
    }
    cloned.patchFlag = PatchFlags.BAIL
    return cloned
  }

  // class component normalization.
  if (isClassComponent(type)) {
    isFunction(type) && console.log('不应该后面都等于 函数类型')
    type = type.__vccOpts
  }

  // 2.x async/functional component compat
  if (__COMPAT__) {

    type = convertLegacyComponent(type, currentRenderingInstance)
  }

  // class & style normalization.
  if (props) {
    // for reactive or proxy objects, we need to clone it to enable mutation.
    props = guardReactiveProps(props)!
    let { class: klass, style } = props
    if (klass && !isString(klass)) {
      props.class = normalizeClass(klass)
    }
    if (isObject(style)) {
      // reactive state objects need to be cloned since they are likely to be
      // mutated
      if (isProxy(style) && !isArray(style)) {
        style = extend({}, style)
      }
      props.style = normalizeStyle(style)
    }
  }

  // encode the vnode type information into a bitmap
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
      `Vue received a Component that was made a reactive object. This can ` +
      `lead to unnecessary performance overhead and should be avoided by ` +
      `marking the component with \`markRaw\` or using \`shallowRef\` ` +
      `instead of \`ref\`.`,
      `\nComponent that was made reactive: `,
      type,
    )
  }



  return createBaseVNode(
    type,
    props,
    children,
    patchFlag,
    dynamicProps,
    shapeFlag,
    isBlockNode,
    true,
  )
}

const createVNodeWithArgsTransform = (
  ...args: Parameters<typeof _createVNode>
): VNode => {
  return _createVNode(
    ...(vnodeArgsTransformer
      ? vnodeArgsTransformer(args, currentRenderingInstance)
      : args),
  )
}

export const createVNode = (
  __DEV__ ? createVNodeWithArgsTransform : _createVNode
) as typeof _createVNode

function createBaseVNode(
  type: VNodeTypes | ClassComponent | typeof NULL_DYNAMIC_COMPONENT,
  props: (Data & VNodeProps) | null = null,
  children: unknown = null,
  patchFlag = 0,
  dynamicProps: string[] | null = null,
  shapeFlag: number = type === Fragment ? 0 : ShapeFlags.ELEMENT,
  isBlockNode = false,
  needFullChildrenNormalization = false,
): VNode {
  const vnode = {
    __v_isVNode: true,
    __v_skip: true,
    type,
    props,
    key: props && normalizeKey(props),
    ref: props && normalizeRef(props),
    scopeId: currentScopeId,
    slotScopeIds: null,
    children,
    component: null,
    suspense: null,
    ssContent: null,
    ssFallback: null,
    dirs: null,
    transition: null,
    el: null,
    anchor: null,
    target: null,
    targetStart: null,
    targetAnchor: null,
    staticCount: 0,
    shapeFlag,
    patchFlag,
    dynamicProps,
    dynamicChildren: null,
    appContext: null,
    ctx: currentRenderingInstance,
  } as VNode

  if (needFullChildrenNormalization) {
    normalizeChildren(vnode, children)
    // normalize suspense children
    if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
      ; (type as typeof SuspenseImpl).normalize(vnode)
    }
  } else if (children) {
    // compiled element vnode - if children is passed, only possible types are
    // string or Array.
    vnode.shapeFlag |= isString(children)
      ? ShapeFlags.TEXT_CHILDREN
      : ShapeFlags.ARRAY_CHILDREN
  }

  // validate key
  if (__DEV__ && vnode.key !== vnode.key) {
    warn(`VNode created with invalid key (NaN). VNode type:`, vnode.type)
  }

  // track vnode for block tree
  if (
    isBlockTreeEnabled > 0 &&
    // avoid a block node from tracking itself
    !isBlockNode &&
    // has current parent block
    currentBlock &&
    // presence of a patch flag indicates this node needs patching on updates.
    // component nodes also should always be patched, because even if the
    // component doesn't need to update, it needs to persist the instance on to
    // the next vnode so that it can be properly unmounted later.
    (vnode.patchFlag > 0 || shapeFlag & ShapeFlags.COMPONENT) &&
    // the EVENTS flag is only for hydration and if it is the only flag, the
    // vnode should not be considered dynamic due to handler caching.
    vnode.patchFlag !== PatchFlags.NEED_HYDRATION
  ) {
    currentBlock.push(vnode)
  }

  if (__COMPAT__) {
    convertLegacyVModelProps(vnode)
    defineLegacyVNodeProperties(vnode)
  }

  return vnode
}
export function normalizeClass(value: unknown): string {
  let res = ''
  if (isString(value)) {
    res = value
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeClass(value[i])
      if (normalized) {
        res += normalized + ' '
      }
    }
  } else if (isObject(value)) {
    for (const name in value) {
      if (value[name]) {
        res += name + ' '
      }
    }
  }
  return res.trim()
}

export function normalizeStyle(
  value: unknown,
): NormalizedStyle | string | undefined {
  if (isArray(value)) {
    const res: NormalizedStyle = {}
    for (let i = 0; i < value.length; i++) {
      const item = value[i]
      const normalized = isString(item)
        ? parseStringStyle(item)
        : (normalizeStyle(item) as NormalizedStyle)
      if (normalized) {
        for (const key in normalized) {
          res[key] = normalized[key]
        }
      }
    }
    return res
  } else if (isString(value) || isObject(value)) {
    return value
  }
}


export function mergeProps(...args: (Data & VNodeProps)[]): Data {
  const ret: Data = {}
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
        if (
          incoming &&
          existing !== incoming &&
          !(isArray(existing) && existing.includes(incoming))
        ) {
          ret[key] = existing
            ? [].concat(existing as any, incoming as any)
            : incoming
        }
      } else if (key !== '') {
        ret[key] = toMerge[key]
      }
    }
  }
  return ret
}


let internalSetCurrentInstance: (
  instance: ComponentInternalInstance | null,
) => void


export const setCurrentInstance = (instance: ComponentInternalInstance) => {
  const prev = currentInstance
  internalSetCurrentInstance(instance)
  instance.scope.on()
  return (): void => {
    instance.scope.off()
    internalSetCurrentInstance(prev)
  }
}

if (__SSR__) {
  type Setter = (v: any) => void
  const g = getGlobalThis()
  const registerGlobalSetter = (key: string, setter: Setter) => {
    let setters: Setter[]
    if (!(setters = g[key])) setters = g[key] = []
    setters.push(setter)
    return (v: any) => {
      if (setters.length > 1) setters.forEach(set => set(v))
      else setters[0](v)
    }
  }
  internalSetCurrentInstance = registerGlobalSetter(
    `__VUE_INSTANCE_SETTERS__`,
    v => (currentInstance = v),
  )
  // also make `isInSSRComponentSetup` sharable across copies of Vue.
  // this is needed in the SFC playground when SSRing async components, since
  // we have to load both the runtime and the server-renderer from CDNs, they
  // contain duplicated copies of Vue runtime code.
  setInSSRSetupState = registerGlobalSetter(
    `__VUE_SSR_SETTERS__`,
    v => (isInSSRComponentSetup = v),
  )
} else {
  internalSetCurrentInstance = i => {
    currentInstance = i
  }
  setInSSRSetupState = v => {
    isInSSRComponentSetup = v
  }
}



function resolvePropValue(
  options: NormalizedProps,
  props: Data,
  key: string,
  value: unknown,
  instance: ComponentInternalInstance,
  isAbsent: boolean,
) {
  const opt = options[key]
  if (opt != null) {
    const hasDefault = hasOwn(opt, 'default')
    // default values
    if (hasDefault && value === undefined) {
      const defaultValue = opt.default
      if (
        opt.type !== Function &&
        !opt.skipFactory &&
        isFunction(defaultValue)
      ) {
        const { propsDefaults } = instance
        if (key in propsDefaults) {
          value = propsDefaults[key]
        } else {
          const reset = setCurrentInstance(instance)
          value = propsDefaults[key] = defaultValue.call(
            __COMPAT__ &&
              isCompatEnabled(DeprecationTypes.PROPS_DEFAULT_THIS, instance)
              ? createPropsDefaultThis(instance, props, key)
              : null,
            props,
          )
          reset()
        }
      } else {
        value = defaultValue
      }
      // #9006 reflect default value on custom element
      if (instance.ce) {
        instance.ce._setProp(key, value)
      }
    }
    // boolean casting
    if (opt[BooleanFlags.shouldCast]) {
      if (isAbsent && !hasDefault) {
        value = false
      } else if (
        opt[BooleanFlags.shouldCastTrue] &&
        (value === '' || value === hyphenate(key))
      ) {
        value = true
      }
    }
  }
  return value
}
export const getCurrentInstance: () => ComponentInternalInstance | null = () =>
  currentInstance || currentRenderingInstance


export function provide<T, K = InjectionKey<T> | string | number>(
  key: K,
  value: K extends InjectionKey<infer V> ? V : T,
): void {
  if (!currentInstance) {
    if (__DEV__) {
      warn(`provide() can only be used inside setup().`)
    }
  } else {
    let provides = currentInstance.provides
    // by default an instance inherits its parent's provides object
    // but when it needs to provide values of its own, it creates its
    // own provides object using parent provides object as prototype.
    // this way in `inject` we can simply look up injections from direct
    // parent and let the prototype chain do the work.
    const parentProvides =
      currentInstance.parent && currentInstance.parent.provides
    if (parentProvides === provides) {
      provides = currentInstance.provides = Object.create(parentProvides)
    }
    // TS doesn't allow symbol as index type
    provides[key as string] = value
  }
}

export function inject<T>(key: InjectionKey<T> | string): T | undefined
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T,
  treatDefaultAsFactory?: false,
): T
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T | (() => T),
  treatDefaultAsFactory: true,
): T
export function inject(
  key: InjectionKey<any> | string,
  defaultValue?: unknown,
  treatDefaultAsFactory = false,
) {
  // fallback to `currentRenderingInstance` so that this can be called in
  // a functional component
  const instance = getCurrentInstance()

  // also support looking up from app-level provides w/ `app.runWithContext()`
  if (instance || currentApp) {
    // #2400
    // to support `app.use` plugins,
    // fallback to appContext's `provides` if the instance is at root
    // #11488, in a nested createApp, prioritize using the provides from currentApp
    // #13212, for custom elements we must get injected values from its appContext
    // as it already inherits the provides object from the parent element
    let provides = currentApp
      ? currentApp._context.provides
      : instance
        ? instance.parent == null || instance.ce
          ? instance.vnode.appContext && instance.vnode.appContext.provides
          : instance.parent.provides
        : undefined

    if (provides && (key as string | symbol) in provides) {
      // TS doesn't allow symbol as index type
      return provides[key as string]
    } else if (arguments.length > 1) {
      return treatDefaultAsFactory && isFunction(defaultValue)
        ? defaultValue.call(instance && instance.proxy)
        : defaultValue
    } else if (__DEV__) {
      warn(`injection "${String(key)}" not found.`)
    }
  } else if (__DEV__) {
    warn(`inject() can only be used inside setup() or functional components.`)
  }
}



function isInHmrContext(instance: ComponentInternalInstance | null) {
  while (instance) {
    if (instance.type.__hmrId) return true
    instance = instance.parent
  }
}

export function updateProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  rawPrevProps: Data | null,
  optimized: boolean,
): void {
  const {
    props,
    attrs,
    vnode: { patchFlag },
  } = instance
  const rawCurrentProps = toRaw(props)
  const [options] = instance.propsOptions
  let hasAttrsChanged = false

  if (
    // always force full diff in dev
    // - #1942 if hmr is enabled with sfc component
    // - vite#872 non-sfc component used by sfc component
    !(__DEV__ && isInHmrContext(instance)) &&
    (optimized || patchFlag > 0) &&
    !(patchFlag & PatchFlags.FULL_PROPS)
  ) {
    if (patchFlag & PatchFlags.PROPS) {
      // Compiler-generated props & no keys change, just set the updated
      // the props.
      const propsToUpdate = instance.vnode.dynamicProps!
      for (let i = 0; i < propsToUpdate.length; i++) {
        let key = propsToUpdate[i]
        // skip if the prop key is a declared emit event listener
        if (isEmitListener(instance.emitsOptions, key)) {
          continue
        }
        // PROPS flag guarantees rawProps to be non-null
        const value = rawProps![key]
        if (options) {
          // attr / props separation was done on init and will be consistent
          // in this code path, so just check if attrs have it.
          if (hasOwn(attrs, key)) {
            if (value !== attrs[key]) {
              attrs[key] = value
              hasAttrsChanged = true
            }
          } else {
            const camelizedKey = camelize(key)
            props[camelizedKey] = resolvePropValue(
              options,
              rawCurrentProps,
              camelizedKey,
              value,
              instance,
              false /* isAbsent */,
            )
          }
        } else {
          if (__COMPAT__) {
            if (isOn(key) && key.endsWith('Native')) {
              key = key.slice(0, -6) // remove Native postfix
            } else if (shouldSkipAttr(key, instance)) {
              continue
            }
          }
          if (value !== attrs[key]) {
            attrs[key] = value
            hasAttrsChanged = true
          }
        }
      }
    }
  } else {
    // full props update.
    if (setFullProps(instance, rawProps, props, attrs)) {
      hasAttrsChanged = true
    }
    // in case of dynamic props, check if we need to delete keys from
    // the props object
    let kebabKey: string
    for (const key in rawCurrentProps) {
      if (
        !rawProps ||
        // for camelCase
        (!hasOwn(rawProps, key) &&
          // it's possible the original props was passed in as kebab-case
          // and converted to camelCase (#955)
          ((kebabKey = hyphenate(key)) === key || !hasOwn(rawProps, kebabKey)))
      ) {
        if (options) {
          if (
            rawPrevProps &&
            // for camelCase
            (rawPrevProps[key] !== undefined ||
              // for kebab-case
              rawPrevProps[kebabKey!] !== undefined)
          ) {
            props[key] = resolvePropValue(
              options,
              rawCurrentProps,
              key,
              undefined,
              instance,
              true /* isAbsent */,
            )
          }
        } else {
          delete props[key]
        }
      }
    }
    // in the case of functional component w/o props declaration, props and
    // attrs point to the same object so it should already have been updated.
    if (attrs !== rawCurrentProps) {
      for (const key in attrs) {
        if (
          !rawProps ||
          (!hasOwn(rawProps, key) &&
            (!__COMPAT__ || !hasOwn(rawProps, key + 'Native')))
        ) {
          delete attrs[key]
          hasAttrsChanged = true
        }
      }
    }
  }

  // trigger updates for $attrs in case it's used in component slots
  if (hasAttrsChanged) {
    trigger(instance.attrs, TriggerOpTypes.SET, '')
  }

  if (__DEV__) {
    validateProps(rawProps || {}, props, instance)
  }
}

export const invokeArrayFns = (fns: Function[], ...arg: any[]): void => {
  for (let i = 0; i < fns.length; i++) {
    fns[i](...arg)
  }
}
const isInternalKey = (key: string) =>
  key === '_' || key === '_ctx' || key === '$stable'

const normalizeSlotValue = (value: unknown): VNode[] =>
  isArray(value)
    ? value.map(normalizeVNode)
    : [normalizeVNode(value as VNodeChild)]


const normalizeSlot = (
  key: string,
  rawSlot: Function,
  ctx: ComponentInternalInstance | null | undefined,
): Slot => {
  if ((rawSlot as any)._n) {
    // already normalized - #5353
    return rawSlot as Slot
  }
  const normalized = withCtx((...args: any[]) => {
    if (
      __DEV__ &&
      currentInstance &&
      !(ctx === null && currentRenderingInstance) &&
      !(ctx && ctx.root !== currentInstance.root)
    ) {
      warn(
        `Slot "${key}" invoked outside of the render function: ` +
        `this will not track dependencies used in the slot. ` +
        `Invoke the slot function inside the render function instead.`,
      )
    }
    return normalizeSlotValue(rawSlot(...args))
  }, ctx) as Slot
    // NOT a compiled slot
    ; (normalized as ContextualRenderFn)._c = false
  return normalized
}


const normalizeObjectSlots = (
  rawSlots: RawSlots,
  slots: InternalSlots,
  instance: ComponentInternalInstance,
) => {
  const ctx = rawSlots._ctx
  for (const key in rawSlots) {
    if (isInternalKey(key)) continue
    const value = rawSlots[key]
    if (isFunction(value)) {
      slots[key] = normalizeSlot(key, value, ctx)
    } else if (value != null) {
      if (
        __DEV__ &&
        !(
          __COMPAT__ &&
          isCompatEnabled(DeprecationTypes.RENDER_FUNCTION, instance)
        )
      ) {
        warn(
          `Non-function value encountered for slot "${key}". ` +
          `Prefer function slots for better performance.`,
        )
      }
      const normalized = normalizeSlotValue(value)
      slots[key] = () => normalized
    }
  }
}

const assignSlots = (
  slots: InternalSlots,
  children: Slots,
  optimized: boolean,
) => {
  for (const key in children) {
    // #2893
    // when rendering the optimized slots by manually written render function,
    // do not copy the `slots._` compiler flag so that `renderSlot` creates
    // slot Fragment with BAIL patchFlag to force full updates
    if (optimized || !isInternalKey(key)) {
      slots[key] = children[key]
    }
  }
}

const normalizeVNodeSlots = (
  instance: ComponentInternalInstance,
  children: VNodeNormalizedChildren,
) => {
  if (
    __DEV__ &&
    !isKeepAlive(instance.vnode) &&
    !(__COMPAT__ && isCompatEnabled(DeprecationTypes.RENDER_FUNCTION, instance))
  ) {
    warn(
      `Non-function value encountered for default slot. ` +
      `Prefer function slots for better performance.`,
    )
  }
  const normalized = normalizeSlotValue(children)
  instance.slots.default = () => normalized
}

export const updateSlots = (
  instance: ComponentInternalInstance,
  children: VNodeNormalizedChildren,
  optimized: boolean,
): void => {
  const { vnode, slots } = instance
  let needDeletionCheck = true
  let deletionComparisonTarget = EMPTY_OBJ
  if (vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    const type = (children as RawSlots)._
    if (type) {
      // compiled slots.
      if (__DEV__ && isHmrUpdating) {
        // Parent was HMR updated so slot content may have changed.
        // force update slots and mark instance for hmr as well
        assignSlots(slots, children as Slots, optimized)
        trigger(instance, TriggerOpTypes.SET, '$slots')
      } else if (optimized && type === SlotFlags.STABLE) {
        // compiled AND stable.
        // no need to update, and skip stale slots removal.
        needDeletionCheck = false
      } else {
        // compiled but dynamic (v-if/v-for on slots) - update slots, but skip
        // normalization.
        assignSlots(slots, children as Slots, optimized)
      }
    } else {
      needDeletionCheck = !(children as RawSlots).$stable
      normalizeObjectSlots(children as RawSlots, slots, instance)
    }
    deletionComparisonTarget = children as RawSlots
  } else if (children) {
    // non slot object children (direct value) passed to a component
    normalizeVNodeSlots(instance, children)
    deletionComparisonTarget = { default: 1 }
  }

  // delete stale slots
  if (needDeletionCheck) {
    for (const key in slots) {
      if (!isInternalKey(key) && deletionComparisonTarget[key] == null) {
        delete slots[key]
      }
    }
  }
}


function toggleRecurse(
  { effect, job }: ComponentInternalInstance,
  allowed: boolean,
) {
  if (allowed) {
    effect.flags |= EffectFlags.ALLOW_RECURSE
    job.flags! |= SchedulerJobFlags.ALLOW_RECURSE
  } else {
    effect.flags &= ~EffectFlags.ALLOW_RECURSE
    job.flags! &= ~SchedulerJobFlags.ALLOW_RECURSE
  }
}

/**
 * Dev only, for HMR of hoisted vnodes reused in v-for
 * https://github.com/vitejs/vite/issues/2022
 */
function deepCloneVNode(vnode: VNode): VNode {
  const cloned = cloneVNode(vnode)
  if (isArray(vnode.children)) {
    cloned.children = (vnode.children as VNode[]).map(deepCloneVNode)
  }
  return cloned
}

const getFunctionalFallthrough = (attrs: Data): Data | undefined => {
  let res: Data | undefined
  for (const key in attrs) {
    if (key === 'class' || key === 'style' || isOn(key)) {
      ; (res || (res = {}))[key] = attrs[key]
    }
  }
  return res
}

/**
 * dev only
 * In dev mode, template root level comments are rendered, which turns the
 * template into a fragment root, but we need to locate the single element
 * root for attrs and scope id processing.
 */
const getChildRoot = (vnode: VNode): [VNode, SetRootFn] => {
  const rawChildren = vnode.children as VNodeArrayChildren
  const dynamicChildren = vnode.dynamicChildren
  const childRoot = filterSingleRoot(rawChildren, false)
  if (!childRoot) {
    return [vnode, undefined]
  } else if (
    __DEV__ &&
    childRoot.patchFlag > 0 &&
    childRoot.patchFlag & PatchFlags.DEV_ROOT_FRAGMENT
  ) {
    return getChildRoot(childRoot)
  }

  const index = rawChildren.indexOf(childRoot)
  const dynamicIndex = dynamicChildren ? dynamicChildren.indexOf(childRoot) : -1
  const setRoot: SetRootFn = (updatedRoot: VNode) => {
    rawChildren[index] = updatedRoot
    if (dynamicChildren) {
      if (dynamicIndex > -1) {
        dynamicChildren[dynamicIndex] = updatedRoot
      } else if (updatedRoot.patchFlag > 0) {
        vnode.dynamicChildren = [...dynamicChildren, updatedRoot]
      }
    }
  }
  return [normalizeVNode(childRoot), setRoot]
}


export function renderComponentRoot(
  instance: ComponentInternalInstance,
): VNode {
  const {
    type: Component,
    vnode,
    proxy,
    withProxy,
    propsOptions: [propsOptions],
    slots,
    attrs,
    emit,
    render,
    renderCache,
    props,
    data,
    setupState,
    ctx,
    inheritAttrs,
  } = instance
  const prev = setCurrentRenderingInstance(instance)

  let result
  let fallthroughAttrs
  if (__DEV__) {
    accessedAttrs = false
  }

  try {
    if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
      // withProxy is a proxy with a different `has` trap only for
      // runtime-compiled render functions using `with` block.
      const proxyToUse = withProxy || proxy
      // 'this' isn't available in production builds with `<script setup>`,
      // so warn if it's used in dev.
      const thisProxy =
        __DEV__ && setupState.__isScriptSetup
          ? new Proxy(proxyToUse!, {
            get(target, key, receiver) {
              warn(
                `Property '${String(
                  key,
                )}' was accessed via 'this'. Avoid using 'this' in templates.`,
              )
              return Reflect.get(target, key, receiver)
            },
          })
          : proxyToUse
      result = normalizeVNode(
        render!.call(
          thisProxy,
          proxyToUse!,
          renderCache,
          __DEV__ ? shallowReadonly(props) : props,
          setupState,
          data,
          ctx,
        ),
      )
      fallthroughAttrs = attrs
    } else {
      // functional
      const render = Component as FunctionalComponent
      // in dev, mark attrs accessed if optional props (attrs === props)
      if (__DEV__ && attrs === props) {
        markAttrsAccessed()
      }
      result = normalizeVNode(
        render.length > 1
          ? render(
            __DEV__ ? shallowReadonly(props) : props,
            __DEV__
              ? {
                get attrs() {
                  markAttrsAccessed()
                  return shallowReadonly(attrs)
                },
                slots,
                emit,
              }
              : { attrs, slots, emit },
          )
          : render(
            __DEV__ ? shallowReadonly(props) : props,
            null as any /* we know it doesn't need it */,
          ),
      )
      fallthroughAttrs = Component.props
        ? attrs
        : getFunctionalFallthrough(attrs)
    }
  } catch (err) {
    blockStack.length = 0
    handleError(err, instance, ErrorCodes.RENDER_FUNCTION)

    result = createVNode(Comment)
  }

  // attr merging
  // in dev mode, comments are preserved, and it's possible for a template
  // to have comments along side the root element which makes it a fragment
  let root = result
  let setRoot: SetRootFn = undefined
  if (
    __DEV__ &&
    result.patchFlag > 0 &&
    result.patchFlag & PatchFlags.DEV_ROOT_FRAGMENT
  ) {
    ;[root, setRoot] = getChildRoot(result)
  }

  if (fallthroughAttrs && inheritAttrs !== false) {
    const keys = Object.keys(fallthroughAttrs)
    const { shapeFlag } = root
    if (keys.length) {
      if (shapeFlag & (ShapeFlags.ELEMENT | ShapeFlags.COMPONENT)) {
        if (propsOptions && keys.some(isModelListener)) {
          // If a v-model listener (onUpdate:xxx) has a corresponding declared
          // prop, it indicates this component expects to handle v-model and
          // it should not fallthrough.
          // related: #1543, #1643, #1989
          fallthroughAttrs = filterModelListeners(
            fallthroughAttrs,
            propsOptions,
          )
        }
        root = cloneVNode(root, fallthroughAttrs, false, true)
      } else if (__DEV__ && !accessedAttrs && root.type !== Comment) {
        const allAttrs = Object.keys(attrs)
        const eventAttrs: string[] = []
        const extraAttrs: string[] = []
        for (let i = 0, l = allAttrs.length; i < l; i++) {
          const key = allAttrs[i]
          if (isOn(key)) {
            // ignore v-model handlers when they fail to fallthrough
            if (!isModelListener(key)) {
              // remove `on`, lowercase first letter to reflect event casing
              // accurately
              eventAttrs.push(key[2].toLowerCase() + key.slice(3))
            }
          } else {
            extraAttrs.push(key)
          }
        }
        if (extraAttrs.length) {
          warn(
            `Extraneous non-props attributes (` +
            `${extraAttrs.join(', ')}) ` +
            `were passed to component but could not be automatically inherited ` +
            `because component renders fragment or text or teleport root nodes.`,
          )
        }
        if (eventAttrs.length) {
          warn(
            `Extraneous non-emits event listeners (` +
            `${eventAttrs.join(', ')}) ` +
            `were passed to component but could not be automatically inherited ` +
            `because component renders fragment or text root nodes. ` +
            `If the listener is intended to be a component custom event listener only, ` +
            `declare it using the "emits" option.`,
          )
        }
      }
    }
  }

  if (
    __COMPAT__ &&
    isCompatEnabled(DeprecationTypes.INSTANCE_ATTRS_CLASS_STYLE, instance) &&
    vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT &&
    root.shapeFlag & (ShapeFlags.ELEMENT | ShapeFlags.COMPONENT)
  ) {
    const { class: cls, style } = vnode.props || {}
    if (cls || style) {
      if (__DEV__ && inheritAttrs === false) {
        warnDeprecation(
          DeprecationTypes.INSTANCE_ATTRS_CLASS_STYLE,
          instance,
          getComponentName(instance.type),
        )
      }
      root = cloneVNode(
        root,
        {
          class: cls,
          style: style,
        },
        false,
        true,
      )
    }
  }

  // inherit directives
  if (vnode.dirs) {
    if (__DEV__ && !isElementRoot(root)) {
      warn(
        `Runtime directive used on component with non-element root node. ` +
        `The directives will not function as intended.`,
      )
    }
    // clone before mutating since the root may be a hoisted vnode
    root = cloneVNode(root, null, false, true)
    root.dirs = root.dirs ? root.dirs.concat(vnode.dirs) : vnode.dirs
  }
  // inherit transition data
  if (vnode.transition) {
    if (__DEV__ && !isElementRoot(root)) {
      warn(
        `Component inside <Transition> renders non-element root node ` +
        `that cannot be animated.`,
      )
    }
    setTransitionHooks(root, vnode.transition)
  }

  if (__DEV__ && setRoot) {
    setRoot(root)
  } else {
    result = root
  }

  setCurrentRenderingInstance(prev)
  return result
}

const isElementRoot = (vnode: VNode) => {
  return (
    vnode.shapeFlag & (ShapeFlags.COMPONENT | ShapeFlags.ELEMENT) ||
    vnode.type === Comment // potential v-if branch switch
  )
}

/**
 * Note: rendering calls maybe nested. The function returns the parent rendering
 * instance if present, which should be restored after the render is done:
 *
 * ```js
 * const prev = setCurrentRenderingInstance(i)
 * // ...render
 * setCurrentRenderingInstance(prev)
 * ```
 */
export function setCurrentRenderingInstance(
  instance: ComponentInternalInstance | null,
): ComponentInternalInstance | null {
  const prev = currentRenderingInstance
  currentRenderingInstance = instance
  currentScopeId = (instance && instance.type.__scopeId) || null
  // v2 pre-compiled components uses _scopeId instead of __scopeId
  if (__COMPAT__ && !currentScopeId) {
    currentScopeId = (instance && (instance.type as any)._scopeId) || null
  }
  return prev
}

export function startMeasure(
  instance: ComponentInternalInstance,
  type: string,
): void {
  if (instance.appContext.config.performance && isSupported()) {
    perf.mark(`vue-${type}-${instance.uid}`)
  }

  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    devtoolsPerfStart(instance, type, isSupported() ? perf.now() : Date.now())
  }
}

function isSupported() {
  if (supported !== undefined) {
    return supported
  }
  if (typeof window !== 'undefined' && window.performance) {
    supported = true
    perf = window.performance
  } else {
    supported = false
  }
  return supported
}

export const def = (
  obj: object,
  key: string | symbol,
  value: any,
  writable = false,
): void => {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: false,
    writable,
    value,
  })
}
export function unregisterHMR(instance: ComponentInternalInstance): void {
  map.get(instance.type.__hmrId!)!.instances.delete(instance)
}


export function parseStringStyle(cssText: string): NormalizedStyle {
  const ret: NormalizedStyle = {}
  cssText
    .replace(styleCommentRE, '')
    .split(listDelimiterRE)
    .forEach(item => {
      if (item) {
        const tmp = item.split(propertyDelimiterRE)
        tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim())
      }
    })
  return ret
}

function createDevtoolsPerformanceHook(
  hook: DevtoolsHooks,
): DevtoolsPerformanceHook {
  return (component: ComponentInternalInstance, type: string, time: number) => {
    emit(hook, component.appContext.app, component.uid, component, type, time)
  }
}

export function callWithErrorHandling(
  fn: Function,
  instance: ComponentInternalInstance | null | undefined,
  type: ErrorTypes,
  args?: unknown[],
): any {
  try {
    return args ? fn(...args) : fn()
  } catch (err) {
    handleError(err, instance, type)
  }
}

export function callWithAsyncErrorHandling(
  fn: Function | Function[],
  instance: ComponentInternalInstance | null,
  type: ErrorTypes,
  args?: unknown[],
): any {
  if (isFunction(fn)) {
    const res = callWithErrorHandling(fn, instance, type, args)
    if (res && isPromise(res)) {
      res.catch(err => {
        handleError(err, instance, type)
      })
    }
    return res
  }

  if (isArray(fn)) {
    const values = []
    for (let i = 0; i < fn.length; i++) {
      values.push(callWithAsyncErrorHandling(fn[i], instance, type, args))
    }
    return values
  } else if (__DEV__) {
    warn(
      `Invalid value type passed to callWithAsyncErrorHandling(): ${typeof fn}`,
    )
  }
}


export const devtoolsPerfStart: DevtoolsPerformanceHook =
  /*@__PURE__*/ createDevtoolsPerformanceHook(DevtoolsHooks.PERFORMANCE_START)


export function invokeDirectiveHook(
  vnode: VNode,
  prevVNode: VNode | null,
  instance: ComponentInternalInstance | null,
  name: keyof ObjectDirective,
): void {
  const bindings = vnode.dirs!
  const oldBindings = prevVNode && prevVNode.dirs!
  for (let i = 0; i < bindings.length; i++) {
    const binding = bindings[i]
    if (oldBindings) {
      binding.oldValue = oldBindings[i].value
    }
    let hook = binding.dir[name] as DirectiveHook | DirectiveHook[] | undefined
    if (__COMPAT__ && !hook) {
      hook = mapCompatDirectiveHook(name, binding.dir, instance)
    }
    if (hook) {
      // disable tracking inside all lifecycle hooks
      // since they can potentially be called inside effects.
      pauseTracking()
      callWithAsyncErrorHandling(hook, instance, ErrorCodes.DIRECTIVE_HOOK, [
        vnode.el,
        binding,
        vnode,
        prevVNode,
      ])
      resetTracking()
    }
  }
}

// dev only
export const isRuntimeOnly = (): boolean => !compile


export const deprecationData: Record<DeprecationTypes, DeprecationData> = {
  [DeprecationTypes.GLOBAL_MOUNT]: {
    message:
      `The global app bootstrapping API has changed: vm.$mount() and the "el" ` +
      `option have been removed. Use createApp(RootComponent).mount() instead.`,
    link: `https://v3-migration.vuejs.org/breaking-changes/global-api.html#mounting-app-instance`,
  },

  [DeprecationTypes.GLOBAL_MOUNT_CONTAINER]: {
    message:
      `Vue detected directives on the mount container. ` +
      `In Vue 3, the container is no longer considered part of the template ` +
      `and will not be processed/replaced.`,
    link: `https://v3-migration.vuejs.org/breaking-changes/mount-changes.html`,
  },

  [DeprecationTypes.GLOBAL_EXTEND]: {
    message:
      `Vue.extend() has been removed in Vue 3. ` +
      `Use defineComponent() instead.`,
    link: `https://vuejs.org/api/general.html#definecomponent`,
  },

  [DeprecationTypes.GLOBAL_PROTOTYPE]: {
    message:
      `Vue.prototype is no longer available in Vue 3. ` +
      `Use app.config.globalProperties instead.`,
    link: `https://v3-migration.vuejs.org/breaking-changes/global-api.html#vue-prototype-replaced-by-config-globalproperties`,
  },

  [DeprecationTypes.GLOBAL_SET]: {
    message:
      `Vue.set() has been removed as it is no longer needed in Vue 3. ` +
      `Simply use native JavaScript mutations.`,
  },

  [DeprecationTypes.GLOBAL_DELETE]: {
    message:
      `Vue.delete() has been removed as it is no longer needed in Vue 3. ` +
      `Simply use native JavaScript mutations.`,
  },

  [DeprecationTypes.GLOBAL_OBSERVABLE]: {
    message:
      `Vue.observable() has been removed. ` +
      `Use \`import { reactive } from "vue"\` from Composition API instead.`,
    link: `https://vuejs.org/api/reactivity-core.html#reactive`,
  },

  [DeprecationTypes.GLOBAL_PRIVATE_UTIL]: {
    message:
      `Vue.util has been removed. Please refactor to avoid its usage ` +
      `since it was an internal API even in Vue 2.`,
  },

  [DeprecationTypes.CONFIG_SILENT]: {
    message:
      `config.silent has been removed because it is not good practice to ` +
      `intentionally suppress warnings. You can use your browser console's ` +
      `filter features to focus on relevant messages.`,
  },

  [DeprecationTypes.CONFIG_DEVTOOLS]: {
    message:
      `config.devtools has been removed. To enable devtools for ` +
      `production, configure the __VUE_PROD_DEVTOOLS__ compile-time flag.`,
    link: `https://github.com/vuejs/core/tree/main/packages/vue#bundler-build-feature-flags`,
  },

  [DeprecationTypes.CONFIG_KEY_CODES]: {
    message:
      `config.keyCodes has been removed. ` +
      `In Vue 3, you can directly use the kebab-case key names as v-on modifiers.`,
    link: `https://v3-migration.vuejs.org/breaking-changes/keycode-modifiers.html`,
  },

  [DeprecationTypes.CONFIG_PRODUCTION_TIP]: {
    message: `config.productionTip has been removed.`,
    link: `https://v3-migration.vuejs.org/breaking-changes/global-api.html#config-productiontip-removed`,
  },

  [DeprecationTypes.CONFIG_IGNORED_ELEMENTS]: {
    message: () => {
      let msg = `config.ignoredElements has been removed.`
      if (isRuntimeOnly()) {
        msg += ` Pass the "isCustomElement" option to @vue/compiler-dom instead.`
      } else {
        msg += ` Use config.isCustomElement instead.`
      }
      return msg
    },
    link: `https://v3-migration.vuejs.org/breaking-changes/global-api.html#config-ignoredelements-is-now-config-iscustomelement`,
  },

  [DeprecationTypes.CONFIG_WHITESPACE]: {
    // this warning is only relevant in the full build when using runtime
    // compilation, so it's put in the runtime compatConfig list.
    message:
      `Vue 3 compiler's whitespace option will default to "condense" instead of ` +
      `"preserve". To suppress this warning, provide an explicit value for ` +
      `\`config.compilerOptions.whitespace\`.`,
  },

  [DeprecationTypes.CONFIG_OPTION_MERGE_STRATS]: {
    message:
      `config.optionMergeStrategies no longer exposes internal strategies. ` +
      `Use custom merge functions instead.`,
  },

  [DeprecationTypes.INSTANCE_SET]: {
    message:
      `vm.$set() has been removed as it is no longer needed in Vue 3. ` +
      `Simply use native JavaScript mutations.`,
  },

  [DeprecationTypes.INSTANCE_DELETE]: {
    message:
      `vm.$delete() has been removed as it is no longer needed in Vue 3. ` +
      `Simply use native JavaScript mutations.`,
  },

  [DeprecationTypes.INSTANCE_DESTROY]: {
    message: `vm.$destroy() has been removed. Use app.unmount() instead.`,
    link: `https://vuejs.org/api/application.html#app-unmount`,
  },

  [DeprecationTypes.INSTANCE_EVENT_EMITTER]: {
    message:
      `vm.$on/$once/$off() have been removed. ` +
      `Use an external event emitter library instead.`,
    link: `https://v3-migration.vuejs.org/breaking-changes/events-api.html`,
  },

  [DeprecationTypes.INSTANCE_EVENT_HOOKS]: {
    message: event =>
      `"${event}" lifecycle events are no longer supported. From templates, ` +
      `use the "vue:" prefix instead of "hook:". For example, @${event} ` +
      `should be changed to @vue:${event.slice(5)}. ` +
      `From JavaScript, use Composition API to dynamically register lifecycle ` +
      `hooks.`,
    link: `https://v3-migration.vuejs.org/breaking-changes/vnode-lifecycle-events.html`,
  },

  [DeprecationTypes.INSTANCE_CHILDREN]: {
    message:
      `vm.$children has been removed. Consider refactoring your logic ` +
      `to avoid relying on direct access to child components.`,
    link: `https://v3-migration.vuejs.org/breaking-changes/children.html`,
  },

  [DeprecationTypes.INSTANCE_LISTENERS]: {
    message:
      `vm.$listeners has been removed. In Vue 3, parent v-on listeners are ` +
      `included in vm.$attrs and it is no longer necessary to separately use ` +
      `v-on="$listeners" if you are already using v-bind="$attrs". ` +
      `(Note: the Vue 3 behavior only applies if this compat config is disabled)`,
    link: `https://v3-migration.vuejs.org/breaking-changes/listeners-removed.html`,
  },

  [DeprecationTypes.INSTANCE_SCOPED_SLOTS]: {
    message: `vm.$scopedSlots has been removed. Use vm.$slots instead.`,
    link: `https://v3-migration.vuejs.org/breaking-changes/slots-unification.html`,
  },

  [DeprecationTypes.INSTANCE_ATTRS_CLASS_STYLE]: {
    message: componentName =>
      `Component <${componentName || 'Anonymous'
      }> has \`inheritAttrs: false\` but is ` +
      `relying on class/style fallthrough from parent. In Vue 3, class/style ` +
      `are now included in $attrs and will no longer fallthrough when ` +
      `inheritAttrs is false. If you are already using v-bind="$attrs" on ` +
      `component root it should render the same end result. ` +
      `If you are binding $attrs to a non-root element and expecting ` +
      `class/style to fallthrough on root, you will need to now manually bind ` +
      `them on root via :class="$attrs.class".`,
    link: `https://v3-migration.vuejs.org/breaking-changes/attrs-includes-class-style.html`,
  },

  [DeprecationTypes.OPTIONS_DATA_FN]: {
    message:
      `The "data" option can no longer be a plain object. ` +
      `Always use a function.`,
    link: `https://v3-migration.vuejs.org/breaking-changes/data-option.html`,
  },

  [DeprecationTypes.OPTIONS_DATA_MERGE]: {
    message: (key: string) =>
      `Detected conflicting key "${key}" when merging data option values. ` +
      `In Vue 3, data keys are merged shallowly and will override one another.`,
    link: `https://v3-migration.vuejs.org/breaking-changes/data-option.html#mixin-merge-behavior-change`,
  },

  [DeprecationTypes.OPTIONS_BEFORE_DESTROY]: {
    message: `\`beforeDestroy\` has been renamed to \`beforeUnmount\`.`,
  },

  [DeprecationTypes.OPTIONS_DESTROYED]: {
    message: `\`destroyed\` has been renamed to \`unmounted\`.`,
  },

  [DeprecationTypes.WATCH_ARRAY]: {
    message:
      `"watch" option or vm.$watch on an array value will no longer ` +
      `trigger on array mutation unless the "deep" option is specified. ` +
      `If current usage is intended, you can disable the compat behavior and ` +
      `suppress this warning with:` +
      `\n\n  configureCompat({ ${DeprecationTypes.WATCH_ARRAY}: false })\n`,
    link: `https://v3-migration.vuejs.org/breaking-changes/watch.html`,
  },

  [DeprecationTypes.PROPS_DEFAULT_THIS]: {
    message: (key: string) =>
      `props default value function no longer has access to "this". The compat ` +
      `build only offers access to this.$options.` +
      `(found in prop "${key}")`,
    link: `https://v3-migration.vuejs.org/breaking-changes/props-default-this.html`,
  },

  [DeprecationTypes.CUSTOM_DIR]: {
    message: (legacyHook: string, newHook: string) =>
      `Custom directive hook "${legacyHook}" has been removed. ` +
      `Use "${newHook}" instead.`,
    link: `https://v3-migration.vuejs.org/breaking-changes/custom-directives.html`,
  },

  [DeprecationTypes.V_ON_KEYCODE_MODIFIER]: {
    message:
      `Using keyCode as v-on modifier is no longer supported. ` +
      `Use kebab-case key name modifiers instead.`,
    link: `https://v3-migration.vuejs.org/breaking-changes/keycode-modifiers.html`,
  },

  [DeprecationTypes.ATTR_FALSE_VALUE]: {
    message: (name: string) =>
      `Attribute "${name}" with v-bind value \`false\` will render ` +
      `${name}="false" instead of removing it in Vue 3. To remove the attribute, ` +
      `use \`null\` or \`undefined\` instead. If the usage is intended, ` +
      `you can disable the compat behavior and suppress this warning with:` +
      `\n\n  configureCompat({ ${DeprecationTypes.ATTR_FALSE_VALUE}: false })\n`,
    link: `https://v3-migration.vuejs.org/breaking-changes/attribute-coercion.html`,
  },

  [DeprecationTypes.ATTR_ENUMERATED_COERCION]: {
    message: (name: string, value: any, coerced: string) =>
      `Enumerated attribute "${name}" with v-bind value \`${value}\` will ` +
      `${value === null ? `be removed` : `render the value as-is`
      } instead of coercing the value to "${coerced}" in Vue 3. ` +
      `Always use explicit "true" or "false" values for enumerated attributes. ` +
      `If the usage is intended, ` +
      `you can disable the compat behavior and suppress this warning with:` +
      `\n\n  configureCompat({ ${DeprecationTypes.ATTR_ENUMERATED_COERCION}: false })\n`,
    link: `https://v3-migration.vuejs.org/breaking-changes/attribute-coercion.html`,
  },

  [DeprecationTypes.TRANSITION_CLASSES]: {
    message: ``, // this feature cannot be runtime-detected
  },

  [DeprecationTypes.TRANSITION_GROUP_ROOT]: {
    message:
      `<TransitionGroup> no longer renders a root <span> element by ` +
      `default if no "tag" prop is specified. If you do not rely on the span ` +
      `for styling, you can disable the compat behavior and suppress this ` +
      `warning with:` +
      `\n\n  configureCompat({ ${DeprecationTypes.TRANSITION_GROUP_ROOT}: false })\n`,
    link: `https://v3-migration.vuejs.org/breaking-changes/transition-group.html`,
  },

  [DeprecationTypes.COMPONENT_ASYNC]: {
    message: (comp: any) => {
      const name = getComponentName(comp)
      return (
        `Async component${name ? ` <${name}>` : `s`
        } should be explicitly created via \`defineAsyncComponent()\` ` +
        `in Vue 3. Plain functions will be treated as functional components in ` +
        `non-compat build. If you have already migrated all async component ` +
        `usage and intend to use plain functions for functional components, ` +
        `you can disable the compat behavior and suppress this ` +
        `warning with:` +
        `\n\n  configureCompat({ ${DeprecationTypes.COMPONENT_ASYNC}: false })\n`
      )
    },
    link: `https://v3-migration.vuejs.org/breaking-changes/async-components.html`,
  },

  [DeprecationTypes.COMPONENT_FUNCTIONAL]: {
    message: (comp: any) => {
      const name = getComponentName(comp)
      return (
        `Functional component${name ? ` <${name}>` : `s`
        } should be defined as a plain function in Vue 3. The "functional" ` +
        `option has been removed. NOTE: Before migrating to use plain ` +
        `functions for functional components, first make sure that all async ` +
        `components usage have been migrated and its compat behavior has ` +
        `been disabled.`
      )
    },
    link: `https://v3-migration.vuejs.org/breaking-changes/functional-components.html`,
  },

  [DeprecationTypes.COMPONENT_V_MODEL]: {
    message: (comp: ComponentOptions) => {
      const configMsg =
        `opt-in to ` +
        `Vue 3 behavior on a per-component basis with \`compatConfig: { ${DeprecationTypes.COMPONENT_V_MODEL}: false }\`.`
      if (
        comp.props &&
        (isArray(comp.props)
          ? comp.props.includes('modelValue')
          : hasOwn(comp.props, 'modelValue'))
      ) {
        return (
          `Component declares "modelValue" prop, which is Vue 3 usage, but ` +
          `is running under Vue 2 compat v-model behavior. You can ${configMsg}`
        )
      }
      return (
        `v-model usage on component has changed in Vue 3. Component that expects ` +
        `to work with v-model should now use the "modelValue" prop and emit the ` +
        `"update:modelValue" event. You can update the usage and then ${configMsg}`
      )
    },
    link: `https://v3-migration.vuejs.org/breaking-changes/v-model.html`,
  },

  [DeprecationTypes.RENDER_FUNCTION]: {
    message:
      `Vue 3's render function API has changed. ` +
      `You can opt-in to the new API with:` +
      `\n\n  configureCompat({ ${DeprecationTypes.RENDER_FUNCTION}: false })\n` +
      `\n  (This can also be done per-component via the "compatConfig" option.)`,
    link: `https://v3-migration.vuejs.org/breaking-changes/render-function-api.html`,
  },

  [DeprecationTypes.FILTERS]: {
    message:
      `filters have been removed in Vue 3. ` +
      `The "|" symbol will be treated as native JavaScript bitwise OR operator. ` +
      `Use method calls or computed properties instead.`,
    link: `https://v3-migration.vuejs.org/breaking-changes/filters.html`,
  },

  [DeprecationTypes.PRIVATE_APIS]: {
    message: name =>
      `"${name}" is a Vue 2 private API that no longer exists in Vue 3. ` +
      `If you are seeing this warning only due to a dependency, you can ` +
      `suppress this warning via { PRIVATE_APIS: 'suppress-warning' }.`,
  },
}


export function warnDeprecation(
  key: DeprecationTypes,
  instance: ComponentInternalInstance | null,
  ...args: any[]
): void {
  if (!__DEV__) {
    return
  }
  if (__TEST__ && !warningEnabled) {
    return
  }

  instance = instance || getCurrentInstance()

  // check user config
  const config = getCompatConfigForKey(key, instance)
  if (config === 'suppress-warning') {
    return
  }

  const dupKey = key + args.join('')
  let compId: string | number | null =
    instance && formatComponentName(instance, instance.type)
  if (compId === 'Anonymous' && instance) {
    compId = instance.uid
  }

  // skip if the same warning is emitted for the same component type
  const componentDupKey = dupKey + compId
  if (!__TEST__ && componentDupKey in instanceWarned) {
    return
  }
  instanceWarned[componentDupKey] = true

  // same warning, but different component. skip the long message and just
  // log the key and count.
  if (!__TEST__ && dupKey in warnCount) {
    warn(`(deprecation ${key}) (${++warnCount[dupKey] + 1})`)
    return
  }

  warnCount[dupKey] = 0

  const { message, link } = deprecationData[key]
  warn(
    `(deprecation ${key}) ${typeof message === 'function' ? message(...args) : message
    }${link ? `\n  Details: ${link}` : ``}`,
  )
  if (!isCompatEnabled(key, instance, true)) {
    console.error(
      `^ The above deprecation's compat behavior is disabled and will likely ` +
      `lead to runtime errors.`,
    )
  }
}


/**
 * Use this for features where legacy usage is still possible, but will likely
 * lead to runtime error if compat is disabled. (warn in all cases)
 */
export function softAssertCompatEnabled(
  key: DeprecationTypes,
  instance: ComponentInternalInstance | null,
  ...args: any[]
): boolean {
  if (__DEV__) {
    warnDeprecation(key, instance, ...args)
  }
  return isCompatEnabled(key, instance)
}

export function mapCompatDirectiveHook(
  name: keyof ObjectDirective,
  dir: ObjectDirective & LegacyDirective,
  instance: ComponentInternalInstance | null,
): DirectiveHook | DirectiveHook[] | undefined {
  const mappedName = legacyDirectiveHookMap[name]
  if (mappedName) {
    if (isArray(mappedName)) {
      const hook: DirectiveHook[] = []
      mappedName.forEach(mapped => {
        const mappedHook = dir[mapped]
        if (mappedHook) {
          softAssertCompatEnabled(
            DeprecationTypes.CUSTOM_DIR,
            instance,
            mapped,
            name,
          )
          hook.push(mappedHook)
        }
      })
      return hook.length ? hook : undefined
    } else {
      if (dir[mappedName]) {
        softAssertCompatEnabled(
          DeprecationTypes.CUSTOM_DIR,
          instance,
          mappedName,
          name,
        )
      }
      return dir[mappedName]
    }
  }
}


export function queueEffectWithSuspense(
  fn: Function | Function[],
  suspense: SuspenseBoundary | null,
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

export function queuePostFlushCb(cb: SchedulerJobs): void {
  if (!isArray(cb)) {
    if (activePostFlushCbs && cb.id === -1) {
      activePostFlushCbs.splice(postFlushIndex + 1, 0, cb)
    } else if (!(cb.flags! & SchedulerJobFlags.QUEUED)) {
      pendingPostFlushCbs.push(cb)
      cb.flags! |= SchedulerJobFlags.QUEUED
    }
  } else {
    // if cb is an array, it is a component lifecycle hook which can only be
    // triggered by a job, which is already deduped in the main queue, so
    // we can skip duplicate check here to improve perf
    pendingPostFlushCbs.push(...cb)
  }
  queueFlush()
}

function queueFlush() {
  if (!currentFlushPromise) {
    currentFlushPromise = resolvedPromise.then(flushJobs)
  }
}

function flushJobs(seen?: CountMap) {
  if (__DEV__) {
    seen = seen || new Map()
  }

  // conditional usage of checkRecursiveUpdate must be determined out of
  // try ... catch block since Rollup by default de-optimizes treeshaking
  // inside try-catch. This can leave all warning code unshaked. Although
  // they would get eventually shaken by a minifier like terser, some minifiers
  // would fail to do that (e.g. https://github.com/evanw/esbuild/issues/1610)
  const check = __DEV__
    ? (job: SchedulerJob) => checkRecursiveUpdates(seen!, job)
    : NOOP

  try {
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex]
      if (job && !(job.flags! & SchedulerJobFlags.DISPOSED)) {
        if (__DEV__ && check(job)) {
          continue
        }
        if (job.flags! & SchedulerJobFlags.ALLOW_RECURSE) {
          job.flags! &= ~SchedulerJobFlags.QUEUED
        }
        callWithErrorHandling(
          job,
          job.i,
          job.i ? ErrorCodes.COMPONENT_UPDATE : ErrorCodes.SCHEDULER,
        )
        if (!(job.flags! & SchedulerJobFlags.ALLOW_RECURSE)) {
          job.flags! &= ~SchedulerJobFlags.QUEUED
        }
      }
    }
  } finally {
    // If there was an error we still need to clear the QUEUED flags
    for (; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex]
      if (job) {
        job.flags! &= ~SchedulerJobFlags.QUEUED
      }
    }

    flushIndex = -1
    queue.length = 0

    flushPostFlushCbs(seen)

    currentFlushPromise = null
    // If new jobs have been added to either queue, keep flushing
    if (queue.length || pendingPostFlushCbs.length) {
      flushJobs(seen)
    }
  }
}

const getId = (job: SchedulerJob): number =>
  job.id == null ? (job.flags! & SchedulerJobFlags.PRE ? -1 : Infinity) : job.id


export function flushPostFlushCbs(seen?: CountMap): void {
  if (pendingPostFlushCbs.length) {
    const deduped = [...new Set(pendingPostFlushCbs)].sort(
      (a, b) => getId(a) - getId(b),
    )
    pendingPostFlushCbs.length = 0

    // #1947 already has active queue, nested flushPostFlushCbs call
    if (activePostFlushCbs) {
      activePostFlushCbs.push(...deduped)
      return
    }

    activePostFlushCbs = deduped
    if (__DEV__) {
      seen = seen || new Map()
    }

    for (
      postFlushIndex = 0;
      postFlushIndex < activePostFlushCbs.length;
      postFlushIndex++
    ) {
      const cb = activePostFlushCbs[postFlushIndex]
      if (__DEV__ && checkRecursiveUpdates(seen!, cb)) {
        continue
      }
      if (cb.flags! & SchedulerJobFlags.ALLOW_RECURSE) {
        cb.flags! &= ~SchedulerJobFlags.QUEUED
      }
      if (!(cb.flags! & SchedulerJobFlags.DISPOSED)) cb()
      cb.flags! &= ~SchedulerJobFlags.QUEUED
    }
    activePostFlushCbs = null
    postFlushIndex = 0
  }
}
export function getComponentName(
  Component: ConcreteComponent,
  includeInferred = true,
): string | false | undefined {
  return isFunction(Component)
    ? Component.displayName || Component.name
    : Component.name || (includeInferred && Component.__name)
}

export function handleError(
  err: unknown,
  instance: ComponentInternalInstance | null | undefined,
  type: ErrorTypes,
  throwInDev = true,
): void {
  const contextVNode = instance ? instance.vnode : null
  const { errorHandler, throwUnhandledErrorInProduction } =
    (instance && instance.appContext.config) || EMPTY_OBJ
  if (instance) {
    let cur = instance.parent
    // the exposed instance is the render proxy to keep it consistent with 2.x
    const exposedInstance = instance.proxy
    // in production the hook receives only the error code
    const errorInfo = __DEV__
      ? ErrorTypeStrings[type]
      : `https://vuejs.org/error-reference/#runtime-${type}`
    while (cur) {
      const errorCapturedHooks = cur.ec
      if (errorCapturedHooks) {
        for (let i = 0; i < errorCapturedHooks.length; i++) {
          if (
            errorCapturedHooks[i](err, exposedInstance, errorInfo) === false
          ) {
            return
          }
        }
      }
      cur = cur.parent
    }
    // app-level handling
    if (errorHandler) {
      pauseTracking()
      callWithErrorHandling(errorHandler, null, ErrorCodes.APP_ERROR_HANDLER, [
        err,
        exposedInstance,
        errorInfo,
      ])
      resetTracking()
      return
    }
  }
  logError(err, type, contextVNode, throwInDev, throwUnhandledErrorInProduction)
}

const filterModelListeners = (attrs: Data, props: NormalizedProps): Data => {
  const res: Data = {}
  for (const key in attrs) {
    if (!isModelListener(key) || !(key.slice(9) in props)) {
      res[key] = attrs[key]
    }
  }
  return res
}

export function popWarningContext(): void {
  stack.pop()
}
export function pushWarningContext(vnode: VNode): void {
  stack.push(vnode)
}

function logError(
  err: unknown,
  type: ErrorTypes,
  contextVNode: VNode | null,
  throwInDev = true,
  throwInProd = false,
) {
  if (__DEV__) {
    const info = ErrorTypeStrings[type]
    if (contextVNode) {
      pushWarningContext(contextVNode)
    }
    warn(`Unhandled error${info ? ` during execution of ${info}` : ``}`)
    if (contextVNode) {
      popWarningContext()
    }
    // crash in dev by default so it's more noticeable
    if (throwInDev) {
      throw err
    } else if (!__TEST__) {
      console.error(err)
    }
  } else if (throwInProd) {
    throw err
  } else {
    // recover in prod to reduce the impact on end-user
    console.error(err)
  }
}


function checkRecursiveUpdates(seen: CountMap, fn: SchedulerJob) {
  const count = seen.get(fn) || 0
  if (count > RECURSION_LIMIT) {
    const instance = fn.i
    const componentName = instance && getComponentName(instance.type)
    handleError(
      `Maximum recursive updates exceeded${componentName ? ` in component <${componentName}>` : ``
      }. ` +
      `This means you have a reactive effect that is mutating its own ` +
      `dependencies and thus recursively triggering itself. Possible sources ` +
      `include component template, render function, updated hook or ` +
      `watcher source function.`,
      null,
      ErrorCodes.APP_ERROR_HANDLER,
    )
    return true
  }
  seen.set(fn, count + 1)
  return false
}

export function stringifyStyle(
  styles: NormalizedStyle | string | undefined,
): string {
  if (!styles) return ''
  if (isString(styles)) return styles

  let ret = ''
  for (const key in styles) {
    const value = styles[key]
    if (isString(value) || typeof value === 'number') {
      const normalizedKey = key.startsWith(`--`) ? key : hyphenate(key)
      // only render valid values
      ret += `${normalizedKey}:${value};`
    }
  }
  return ret
}
function toClassSet(str: string): Set<string> {
  return new Set(str.trim().split(/\s+/))
}
const cacheStringFunction = <T extends (str: string) => string>(fn: T): T => {
  const cache: Record<string, string> = Object.create(null)
  return ((str: string) => {
    const hit = cache[str]
    return hit || (cache[str] = fn(str))
  }) as T
}

/**
 * @private
 */
export const hyphenate: (str: string) => string = cacheStringFunction(
  (str: string) => str.replace(hyphenateRE, '-$1').toLowerCase(),
)

export function endMeasure(
  instance: ComponentInternalInstance,
  type: string,
): void {
  if (instance.appContext.config.performance && isSupported()) {
    const startTag = `vue-${type}-${instance.uid}`
    const endTag = startTag + `:end`
    const measureName = `<${formatComponentName(instance, instance.type)}> ${type}`
    perf.mark(endTag)
    perf.measure(measureName, startTag, endTag)
    perf.clearMeasures(measureName)
    perf.clearMarks(startTag)
    perf.clearMarks(endTag)
  }

  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    devtoolsPerfEnd(instance, type, isSupported() ? perf.now() : Date.now())
  }
}

const classify = (str: string): string =>
  str.replace(classifyRE, c => c.toUpperCase()).replace(/[-_]/g, '')


export function formatComponentName(
  instance: ComponentInternalInstance | null,
  Component: ConcreteComponent,
  isRoot = false,
): string {
  let name = getComponentName(Component)
  if (!name && Component.__file) {
    const match = Component.__file.match(/([^/\\]+)\.\w+$/)
    if (match) {
      name = match[1]
    }
  }

  if (!name && instance && instance.parent) {
    // try to infer the name based on reverse resolution
    const inferFromRegistry = (registry: Record<string, any> | undefined) => {
      for (const key in registry) {
        if (registry[key] === Component) {
          return key
        }
      }
    }
    name =
      inferFromRegistry(
        instance.components ||
        (instance.parent.type as ComponentOptions).components,
      ) || inferFromRegistry(instance.appContext.components)
  }

  return name ? classify(name) : isRoot ? `App` : `Anonymous`
}

export const legacySlotProxyHandlers: ProxyHandler<InternalSlots> = {
  get(target, key: string) {
    const slot = target[key]
    return slot && slot()
  },
}

export function convertLegacyFunctionalComponent(
  comp: ComponentOptions,
): FunctionalComponent {
  if (normalizedFunctionalComponentMap.has(comp)) {
    return normalizedFunctionalComponentMap.get(comp)!
  }

  const legacyFn = comp.render as any

  const Func: FunctionalComponent = (props, ctx) => {
    const instance = getCurrentInstance()!

    const legacyCtx = {
      props,
      children: instance.vnode.children || [],
      data: instance.vnode.props || {},
      scopedSlots: ctx.slots,
      parent: instance.parent && instance.parent.proxy,
      slots() {
        return new Proxy(ctx.slots, legacySlotProxyHandlers)
      },
      get listeners() {
        return getCompatListeners(instance)
      },
      get injections() {
        if (comp.inject) {
          const injections = {}
          resolveInjections(comp.inject, injections)
          return injections
        }
        return {}
      },
    }
    return legacyFn(compatH, legacyCtx)
  }
  Func.props = comp.props
  Func.displayName = comp.name
  Func.compatConfig = comp.compatConfig
  // v2 functional components do not inherit attrs
  Func.inheritAttrs = false

  normalizedFunctionalComponentMap.set(comp, Func)
  return Func
}


export const devtoolsPerfEnd: DevtoolsPerformanceHook =
  /*@__PURE__*/ createDevtoolsPerformanceHook(DevtoolsHooks.PERFORMANCE_END)

export function convertLegacyComponent(
  comp: any,
  instance: ComponentInternalInstance | null,
): Component {
  if (comp.__isBuiltIn) {
    return comp
  }

  // 2.x constructor
  if (isFunction(comp) && comp.cid) {
    // #7766
    if (comp.render) {
      // only necessary when compiled from SFC
      comp.options.render = comp.render
    }
    // copy over internal properties set by the SFC compiler
    comp.options.__file = comp.__file
    comp.options.__hmrId = comp.__hmrId
    comp.options.__scopeId = comp.__scopeId
    comp = comp.options
  }

  // 2.x async component
  if (
    isFunction(comp) &&
    checkCompatEnabled(DeprecationTypes.COMPONENT_ASYNC, instance, comp)
  ) {
    // since after disabling this, plain functions are still valid usage, do not
    // use softAssert here.
    return convertLegacyAsyncComponent(comp)
  }

  // 2.x functional component
  if (
    isObject(comp) &&
    comp.functional &&
    softAssertCompatEnabled(
      DeprecationTypes.COMPONENT_FUNCTIONAL,
      instance,
      comp,
    )
  ) {
    return convertLegacyFunctionalComponent(comp)
  }

  return comp
}


export function normalizeChildren(vnode: VNode, children: unknown): void {
  let type = 0
  const { shapeFlag } = vnode
  if (children == null) {
    children = null
  } else if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN
  } else if (typeof children === 'object') {
    if (shapeFlag & (ShapeFlags.ELEMENT | ShapeFlags.TELEPORT)) {
      // Normalize slot to plain children for plain element and Teleport
      const slot = (children as any).default
      if (slot) {
        // _c marker is added by withCtx() indicating this is a compiled slot
        slot._c && (slot._d = false)
        normalizeChildren(vnode, slot())
        slot._c && (slot._d = true)
      }
      return
    } else {
      type = ShapeFlags.SLOTS_CHILDREN
      const slotFlag = (children as RawSlots)._
      if (!slotFlag && !isInternalObject(children)) {
        // if slots are not normalized, attach context instance
        // (compiled / normalized slots already have context)
        ; (children as RawSlots)._ctx = currentRenderingInstance
      } else if (slotFlag === SlotFlags.FORWARDED && currentRenderingInstance) {
        // a child component receives forwarded slots from the parent.
        // its slot type is determined by its parent's slot type.
        if (
          (currentRenderingInstance.slots as RawSlots)._ === SlotFlags.STABLE
        ) {
          ; (children as RawSlots)._ = SlotFlags.STABLE
        } else {
          ; (children as RawSlots)._ = SlotFlags.DYNAMIC
          vnode.patchFlag |= PatchFlags.DYNAMIC_SLOTS
        }
      }
    }
  } else if (isFunction(children)) {
    children = { default: children, _ctx: currentRenderingInstance }
    type = ShapeFlags.SLOTS_CHILDREN
  } else {
    children = String(children)
    // force teleport children to array so it can be moved around
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
 * dev only
 */
function validateProps(
  rawProps: Data,
  props: Data,
  instance: ComponentInternalInstance,
) {
  const resolvedValues = toRaw(props)
  const options = instance.propsOptions[0]
  const camelizePropsKey = Object.keys(rawProps).map(key => camelize(key))
  for (const key in options) {
    let opt = options[key]
    if (opt == null) continue
    validateProp(
      key,
      resolvedValues[key],
      opt,
      __DEV__ ? shallowReadonly(resolvedValues) : resolvedValues,
      !camelizePropsKey.includes(key),
    )
  }
}

/**
 * dev only
 */
function styleValue(value: unknown, type: string): string {
  if (type === 'String') {
    return `"${value}"`
  } else if (type === 'Number') {
    return `${Number(value)}`
  } else {
    return `${value}`
  }
}

/**
 * dev only
 */
function isBoolean(...args: string[]): boolean {
  return args.some(elem => elem.toLowerCase() === 'boolean')
}
/**
 * dev only
 */
function isExplicable(type: string): boolean {
  const explicitTypes = ['string', 'number', 'boolean']
  return explicitTypes.some(elem => type.toLowerCase() === elem)
}

/**
 * dev only
 */
function getInvalidTypeMessage(
  name: string,
  value: unknown,
  expectedTypes: string[],
): string {
  if (expectedTypes.length === 0) {
    return (
      `Prop type [] for prop "${name}" won't match anything.` +
      ` Did you mean to use type Array instead?`
    )
  }
  let message =
    `Invalid prop: type check failed for prop "${name}".` +
    ` Expected ${expectedTypes.map(capitalize).join(' | ')}`
  const expectedType = expectedTypes[0]
  const receivedType = toRawType(value)
  const expectedValue = styleValue(value, expectedType)
  const receivedValue = styleValue(value, receivedType)
  // check if we need to specify expected value
  if (
    expectedTypes.length === 1 &&
    isExplicable(expectedType) &&
    !isBoolean(expectedType, receivedType)
  ) {
    message += ` with value ${expectedValue}`
  }
  message += `, got ${receivedType} `
  // check if we need to specify received value
  if (isExplicable(receivedType)) {
    message += `with value ${receivedValue}.`
  }
  return message
}


/**
 * dev only
 */
function validateProp(
  name: string,
  value: unknown,
  prop: PropOptions,
  props: Data,
  isAbsent: boolean,
) {
  const { type, required, validator, skipCheck } = prop
  // required!
  if (required && isAbsent) {
    warn('Missing required prop: "' + name + '"')
    return
  }
  // missing but optional
  if (value == null && !required) {
    return
  }
  // type check
  if (type != null && type !== true && !skipCheck) {
    let isValid = false
    const types = isArray(type) ? type : [type]
    const expectedTypes = []
    // value is valid as long as one of the specified types match
    for (let i = 0; i < types.length && !isValid; i++) {
      const { valid, expectedType } = assertType(value, types[i])
      expectedTypes.push(expectedType || '')
      isValid = valid
    }
    if (!isValid) {
      warn(getInvalidTypeMessage(name, value, expectedTypes))
      return
    }
  }
  // custom validator
  if (validator && !validator(value, props)) {
    warn('Invalid prop: custom validator check failed for prop "' + name + '".')
  }
}


export function createPropsDefaultThis(
  instance: ComponentInternalInstance,
  rawProps: Data,
  propKey: string,
): object {
  return new Proxy(
    {},
    {
      get(_, key: string) {
        __DEV__ &&
          warnDeprecation(DeprecationTypes.PROPS_DEFAULT_THIS, null, propKey)
        // $options
        if (key === '$options') {
          return resolveMergedOptions(instance)
        }
        // props
        if (key in rawProps) {
          return rawProps[key]
        }
        // injections
        const injections = (instance.type as ComponentOptions).inject
        if (injections) {
          if (isArray(injections)) {
            if (injections.includes(key)) {
              return inject(key)
            }
          } else if (key in injections) {
            return inject(key)
          }
        }
      },
    },
  )
}


export function createAppAPI<HostElement>(
  render: RootRenderFunction<HostElement>,
  hydrate?: RootHydrateFunction,
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent, rootProps = null) {
    if (!isFunction(rootComponent)) {
      rootComponent = extend({}, rootComponent)
    }

    if (rootProps != null && !isObject(rootProps)) {
      __DEV__ && warn(`root props passed to app.mount() must be an object.`)
      rootProps = null
    }

    const context = createAppContext()
    const installedPlugins = new WeakSet()

    const pluginCleanupFns: Array<() => any> = []

    let isMounted = false

    const app: App = (context.app = {
      _uid: uid++,
      _component: rootComponent as ConcreteComponent,
      _props: rootProps,
      _container: null,
      _context: context,
      _instance: null,

      version,

      get config() {
        return context.config
      },

      set config(v) {
        if (__DEV__) {
          warn(
            `app.config cannot be replaced. Modify individual options instead.`,
          )
        }
      },

      use(plugin: Plugin, ...options: any[]) {
        if (installedPlugins.has(plugin)) {
          __DEV__ && warn(`Plugin has already been applied to target app.`)
        } else if (plugin && isFunction(plugin.install)) {
          installedPlugins.add(plugin)
          plugin.install(app, ...options)
        } else if (isFunction(plugin)) {
          installedPlugins.add(plugin)
          plugin(app, ...options)
        } else if (__DEV__) {
          warn(
            `A plugin must either be a function or an object with an "install" ` +
            `function.`,
          )
        }
        return app
      },

      mixin(mixin: ComponentOptions) {
        if (__FEATURE_OPTIONS_API__) {
          if (!context.mixins.includes(mixin)) {
            context.mixins.push(mixin)
          } else if (__DEV__) {
            warn(
              'Mixin has already been applied to target app' +
              (mixin.name ? `: ${mixin.name}` : ''),
            )
          }
        } else if (__DEV__) {
          warn('Mixins are only available in builds supporting Options API')
        }
        return app
      },

      component(name: string, component?: Component): any {
        if (__DEV__) {
          validateComponentName(name, context.config)
        }
        if (!component) {
          return context.components[name]
        }
        if (__DEV__ && context.components[name]) {
          warn(`Component "${name}" has already been registered in target app.`)
        }
        context.components[name] = component
        return app
      },

      directive(name: string, directive?: Directive) {
        if (__DEV__) {
          validateDirectiveName(name)
        }

        if (!directive) {
          return context.directives[name] as any
        }
        if (__DEV__ && context.directives[name]) {
          warn(`Directive "${name}" has already been registered in target app.`)
        }
        context.directives[name] = directive
        return app
      },

      mount(
        rootContainer: HostElement,
        isHydrate?: boolean,
        namespace?: boolean | ElementNamespace,
      ): any {
        if (!isMounted) {
          // #5571
          if (__DEV__ && (rootContainer as any).__vue_app__) {
            warn(
              `There is already an app instance mounted on the host container.\n` +
              ` If you want to mount another app on the same host container,` +
              ` you need to unmount the previous app by calling \`app.unmount()\` first.`,
            )
          }

          const vnode = app._ceVNode || createVNode(rootComponent, rootProps)
          // store app context on the root VNode.
          // this will be set on the root instance on initial mount.
          vnode.appContext = context

          if (namespace === true) {
            namespace = 'svg'
          } else if (namespace === false) {
            namespace = undefined
          }

          // HMR root reload
          if (__DEV__) {
            context.reload = () => {
              const cloned = cloneVNode(vnode)
              // avoid hydration for hmr updating
              cloned.el = null
              // casting to ElementNamespace because TS doesn't guarantee type narrowing
              // over function boundaries
              render(cloned, rootContainer, namespace as ElementNamespace)
            }
          }

          if (isHydrate && hydrate) {
            hydrate(vnode as VNode<Node, Element>, rootContainer as any)
          } else {
            render(vnode, rootContainer, namespace)
          }
          isMounted = true
          app._container = rootContainer
            // for devtools and telemetry
            ; (rootContainer as any).__vue_app__ = app

          if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
            app._instance = vnode.component
            devtoolsInitApp(app, version)
          }

          return getComponentPublicInstance(vnode.component!)
        } else if (__DEV__) {
          warn(
            `App has already been mounted.\n` +
            `If you want to remount the same app, move your app creation logic ` +
            `into a factory function and create fresh app instances for each ` +
            `mount - e.g. \`const createMyApp = () => createApp(App)\``,
          )
        }
      },

      onUnmount(cleanupFn: () => void) {
        if (__DEV__ && typeof cleanupFn !== 'function') {
          warn(
            `Expected function as first argument to app.onUnmount(), ` +
            `but got ${typeof cleanupFn}`,
          )
        }
        pluginCleanupFns.push(cleanupFn)
      },

      unmount() {
        if (isMounted) {
          callWithAsyncErrorHandling(
            pluginCleanupFns,
            app._instance,
            ErrorCodes.APP_UNMOUNT_CLEANUP,
          )
          render(null, app._container)
          if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
            app._instance = null
            devtoolsUnmountApp(app)
          }
          delete app._container.__vue_app__
        } else if (__DEV__) {
          warn(`Cannot unmount an app that is not mounted.`)
        }
      },

      provide(key, value) {
        if (__DEV__ && (key as string | symbol) in context.provides) {
          if (hasOwn(context.provides, key as string | symbol)) {
            warn(
              `App already provides property with key "${String(key)}". ` +
              `It will be overwritten with the new value.`,
            )
          } else {
            // #13212, context.provides can inherit the provides object from parent on custom elements
            warn(
              `App already provides property with key "${String(key)}" inherited from its parent element. ` +
              `It will be overwritten with the new value.`,
            )
          }
        }

        context.provides[key as string | symbol] = value

        return app
      },

      runWithContext(fn) {
        const lastApp = currentApp
        currentApp = app
        try {
          return fn()
        } finally {
          currentApp = lastApp
        }
      },
    })

    if (__COMPAT__) {
      installAppCompatProperties(app, context, render)
    }

    return app
  }
}
export function devtoolsInitApp(app: App, version: string): void {
  emit(DevtoolsHooks.APP_INIT, app, version, {
    Fragment,
    Text,
    Comment,
    Static,
  })
}


export function devtoolsUnmountApp(app: App): void {
  emit(DevtoolsHooks.APP_UNMOUNT, app)
}

function emit(event: string, ...args: any[]) {
  if (devtools) {
    devtools.emit(event, ...args)
  } else if (!devtoolsNotInstalled) {
    buffer.push({ event, args })
  }
}

/**
 * #2437 In Vue 3, functional components do not have a public instance proxy but
 * they exist in the internal parent chain. For code that relies on traversing
 * public $parent chains, skip functional ones and go to the parent instead.
 */
const getPublicInstance = (
  i: ComponentInternalInstance | null,
): ComponentPublicInstance | ComponentInternalInstance['exposed'] | null => {
  if (!i) return null
  if (isStatefulComponent(i)) return getComponentPublicInstance(i)
  return getPublicInstance(i.parent)
}

export function queueJob(job: SchedulerJob): void {
  if (!(job.flags! & SchedulerJobFlags.QUEUED)) {
    const jobId = getId(job)
    const lastJob = queue[queue.length - 1]
    if (
      !lastJob ||
      // fast path when the job id is larger than the tail
      (!(job.flags! & SchedulerJobFlags.PRE) && jobId >= getId(lastJob))
    ) {
      queue.push(job)
    } else {
      queue.splice(findInsertionIndex(jobId), 0, job)
    }

    job.flags! |= SchedulerJobFlags.QUEUED

    queueFlush()
  }
}


// Use binary-search to find a suitable position in the queue. The queue needs
// to be sorted in increasing order of the job ids. This ensures that:
// 1. Components are updated from parent to child. As the parent is always
//    created before the child it will always have a smaller id.
// 2. If a component is unmounted during a parent component's update, its update
//    can be skipped.
// A pre watcher will have the same id as its component's update job. The
// watcher should be inserted immediately before the update job. This allows
// watchers to be skipped if the component is unmounted by the parent update.
function findInsertionIndex(id: number) {
  let start = flushIndex + 1
  let end = queue.length

  while (start < end) {
    const middle = (start + end) >>> 1
    const middleJob = queue[middle]
    const middleJobId = getId(middleJob)
    if (
      middleJobId < id ||
      (middleJobId === id && middleJob.flags! & SchedulerJobFlags.PRE)
    ) {
      start = middle + 1
    } else {
      end = middle
    }
  }

  return start
}

/**
 * Resolve merged options and cache it on the component.
 * This is done only once per-component since the merging does not involve
 * instances.
 */
export function resolveMergedOptions(
  instance: ComponentInternalInstance,
): MergedComponentOptions {
  const base = instance.type as ComponentOptions
  const { mixins, extends: extendsOptions } = base
  const {
    mixins: globalMixins,
    optionsCache: cache,
    config: { optionMergeStrategies },
  } = instance.appContext
  const cached = cache.get(base)

  let resolved: MergedComponentOptions

  if (cached) {
    resolved = cached
  } else if (!globalMixins.length && !mixins && !extendsOptions) {
    if (
      __COMPAT__ &&
      isCompatEnabled(DeprecationTypes.PRIVATE_APIS, instance)
    ) {
      resolved = extend({}, base) as MergedComponentOptions
      resolved.parent = instance.parent && instance.parent.proxy
      resolved.propsData = instance.vnode.props
    } else {
      resolved = base as MergedComponentOptions
    }
  } else {
    resolved = {}
    if (globalMixins.length) {
      globalMixins.forEach(m =>
        mergeOptions(resolved, m, optionMergeStrategies, true),
      )
    }
    mergeOptions(resolved, base, optionMergeStrategies)
  }
  if (isObject(base)) {
    cache.set(base, resolved)
  }
  return resolved
}

/***** watch api ****/
type MaybeUndefined<T, I> = I extends true ? T | undefined : T
export type MultiWatchSources = (WatchSource<unknown> | object)[]
type MapSources<T, Immediate> = {
  [K in keyof T]: T[K] extends WatchSource<infer V>
  ? MaybeUndefined<V, Immediate>
  : T[K] extends object
  ? MaybeUndefined<T[K], Immediate>
  : never
}

// overload: single source + cb
export function watchAPI<T, Immediate extends Readonly<boolean> = false>(
  source: WatchSource<T>,
  cb: WatchCallback<T, MaybeUndefined<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchHandle

// overload: reactive array or tuple of multiple sources + cb
export function watchAPI<
  T extends Readonly<MultiWatchSources>,
  Immediate extends Readonly<boolean> = false,
>(
  sources: readonly [...T] | T,
  cb: [T] extends [ReactiveMarker]
    ? WatchCallback<T, MaybeUndefined<T, Immediate>>
    : WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchHandle

// overload: array of multiple sources + cb
export function watchAPI<
  T extends MultiWatchSources,
  Immediate extends Readonly<boolean> = false,
>(
  sources: [...T],
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchHandle

// overload: watching reactive object w/ cb
export function watchAPI<
  T extends object,
  Immediate extends Readonly<boolean> = false,
>(
  source: T,
  cb: WatchCallback<T, MaybeUndefined<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchHandle

// implementation
export function watchAPI<T = any, Immediate extends Readonly<boolean> = false>(
  source: T | WatchSource<T>,
  cb: any,
  options?: WatchOptions<Immediate>,
): WatchHandle {
  if (__DEV__ && !isFunction(cb)) {
    warn(
      `\`watch(fn, options?)\` signature has been moved to a separate API. ` +
      `Use \`watchEffect(fn, options?)\` instead. \`watch\` now only ` +
      `supports \`watch(source, cb, options?) signature.`,
    )
  }
  return doWatch(source as any, cb, options)
}

// this.$watch
export function instanceWatch(
  this: ComponentInternalInstance,
  source: string | Function,
  value: WatchCallback | ObjectWatchOptionItem,
  options?: WatchAPIOptions,
): WatchHandle {
  const publicThis = this.proxy as any
  const getter = isString(source)
    ? source.includes('.')
      ? createPathGetter(publicThis, source)
      : () => publicThis[source]
    : source.bind(publicThis, publicThis)
  let cb
  if (isFunction(value)) {
    cb = value
  } else {
    cb = value.handler as Function
    options = value
  }
  const reset = setCurrentInstance(this)
  const res = doWatch(getter, cb.bind(publicThis), options)
  reset()
  return res
}


export const publicPropertiesMap: PublicPropertiesMap =
  // Move PURE marker to new line to workaround compiler discarding it
  // due to type annotation
  /*@__PURE__*/ extend(Object.create(null), {
  $: i => i,
  $el: i => i.vnode.el,
  $data: i => i.data,
  $props: i => (__DEV__ ? shallowReadonly(i.props) : i.props),
  $attrs: i => (__DEV__ ? shallowReadonly(i.attrs) : i.attrs),
  $slots: i => (__DEV__ ? shallowReadonly(i.slots) : i.slots),
  $refs: i => (__DEV__ ? shallowReadonly(i.refs) : i.refs),
  $parent: i => getPublicInstance(i.parent),
  $root: i => getPublicInstance(i.root),
  $host: i => i.ce,
  $emit: i => i.emit,
  $options: i => (__FEATURE_OPTIONS_API__ ? resolveMergedOptions(i) : i.type),
  $forceUpdate: i =>
    i.f ||
    (i.f = () => {
      queueJob(i.update)
    }),
  $nextTick: i => i.n || (i.n = nextTick.bind(i.proxy!)),
  $watch: i => (__FEATURE_OPTIONS_API__ ? instanceWatch.bind(i) : NOOP),
} as PublicPropertiesMap)

export function getComponentPublicInstance(
  instance: ComponentInternalInstance,
): ComponentPublicInstance | ComponentInternalInstance['exposed'] | null {
  if (instance.exposed) {
    return (
      instance.exposeProxy ||
      (instance.exposeProxy = new Proxy(proxyRefs(markRaw(instance.exposed)), {
        get(target, key: string) {
          if (key in target) {
            return target[key]
          } else if (key in publicPropertiesMap) {
            return publicPropertiesMap[key](instance)
          }
        },
        has(target, key: string) {
          return key in target || key in publicPropertiesMap
        },
      }))
    )
  } else {
    return instance.proxy
  }
}

export function updateHOCHostEl(
  { vnode, parent }: ComponentInternalInstance,
  el: typeof vnode.el, // HostNode
): void {
  while (parent) {
    const root = parent.subTree
    if (root.suspense && root.suspense.activeBranch === vnode) {
      root.el = vnode.el
    }
    if (root === vnode) {
      ; (vnode = parent.vnode).el = el
      parent = parent.parent
    } else {
      break
    }
  }
}


export function flushPreFlushCbs(
  instance?: ComponentInternalInstance,
  seen?: CountMap,
  // skip the current job
  i: number = flushIndex + 1,
): void {
  if (__DEV__) {
    seen = seen || new Map()
  }
  for (; i < queue.length; i++) {
    const cb = queue[i]
    if (cb && cb.flags! & SchedulerJobFlags.PRE) {
      if (instance && cb.id !== instance.uid) {
        continue
      }
      if (__DEV__ && checkRecursiveUpdates(seen!, cb)) {
        continue
      }
      queue.splice(i, 1)
      i--
      if (cb.flags! & SchedulerJobFlags.ALLOW_RECURSE) {
        cb.flags! &= ~SchedulerJobFlags.QUEUED
      }
      cb()
      if (!(cb.flags! & SchedulerJobFlags.ALLOW_RECURSE)) {
        cb.flags! &= ~SchedulerJobFlags.QUEUED
      }
    }
  }
}

export function validateDirectiveName(name: string): void {
  if (isBuiltInDirective(name)) {
    warn('Do not use built-in directive ids as custom directive id: ' + name)
  }
}



/*! #__NO_SIDE_EFFECTS__ */
function createDevtoolsComponentHook(
  hook: DevtoolsHooks,
): DevtoolsComponentHook {
  return (component: ComponentInternalInstance) => {
    emit(
      hook,
      component.appContext.app,
      component.uid,
      component.parent ? component.parent.uid : undefined,
      component,
    )
  }
}

export const devtoolsComponentUpdated: DevtoolsComponentHook =
  /*@__PURE__*/ createDevtoolsComponentHook(DevtoolsHooks.COMPONENT_UPDATED)


/**
 * Block tracking sometimes needs to be disabled, for example during the
 * creation of a tree that needs to be cached by v-once. The compiler generates
 * code like this:
 *
 * ``` js
 * _cache[1] || (
 *   setBlockTracking(-1, true),
 *   _cache[1] = createVNode(...),
 *   setBlockTracking(1),
 *   _cache[1]
 * )
 * ```
 *
 * @private
 */
export function setBlockTracking(value: number, inVOnce = false): void {
  isBlockTreeEnabled += value
  if (value < 0 && currentBlock && inVOnce) {
    // mark current block so it doesn't take fast path and skip possible
    // nested components during unmount
    currentBlock.hasOnce = true
  }
}

/**
 * Wrap a slot function to memoize current rendering instance
 * @private compiler helper
 */
export function withCtx(
  fn: Function,
  ctx: ComponentInternalInstance | null = currentRenderingInstance,
  isNonScopedSlot?: boolean, // __COMPAT__ only
): Function {
  if (!ctx) return fn

  // already normalized
  if ((fn as ContextualRenderFn)._n) {
    return fn
  }

  const renderFnWithContext: ContextualRenderFn = (...args: any[]) => {
    // If a user calls a compiled slot inside a template expression (#1745), it
    // can mess up block tracking, so by default we disable block tracking and
    // force bail out when invoking a compiled slot (indicated by the ._d flag).
    // This isn't necessary if rendering a compiled `<slot>`, so we flip the
    // ._d flag off when invoking the wrapped fn inside `renderSlot`.
    if (renderFnWithContext._d) {
      setBlockTracking(-1)
    }
    const prevInstance = setCurrentRenderingInstance(ctx)
    let res
    try {
      res = fn(...args)
    } finally {
      setCurrentRenderingInstance(prevInstance)
      if (renderFnWithContext._d) {
        setBlockTracking(1)
      }
    }

    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      devtoolsComponentUpdated(ctx)
    }

    return res
  }

  // mark normalized to avoid duplicated wrapping
  renderFnWithContext._n = true
  // mark this as compiled by default
  // this is used in vnode.ts -> normalizeChildren() to set the slot
  // rendering flag.
  renderFnWithContext._c = true
  // disable block tracking by default
  renderFnWithContext._d = true
  // compat build only flag to distinguish scoped slots from non-scoped ones
  if (__COMPAT__ && isNonScopedSlot) {
    renderFnWithContext._ns = true
  }
  return renderFnWithContext
}


export function convertLegacyVModelProps(vnode: VNode): void {
  const { type, shapeFlag, props, dynamicProps } = vnode
  const comp = type as ComponentOptions
  if (shapeFlag & ShapeFlags.COMPONENT && props && 'modelValue' in props) {
    if (
      !isCompatEnabled(
        DeprecationTypes.COMPONENT_V_MODEL,
        // this is a special case where we want to use the vnode component's
        // compat config instead of the current rendering instance (which is the
        // parent of the component that exposes v-model)
        { type } as any,
      )
    ) {
      return
    }

    if (__DEV__ && !warnedTypes.has(comp)) {
      pushWarningContext(vnode)
      warnDeprecation(DeprecationTypes.COMPONENT_V_MODEL, { type } as any, comp)
      popWarningContext()
      warnedTypes.add(comp)
    }

    // v3 compiled model code -> v2 compat props
    // modelValue -> value
    // onUpdate:modelValue -> onModelCompat:input
    const model = comp.model || {}
    applyModelFromMixins(model, comp.mixins)
    const { prop = 'value', event = 'input' } = model
    if (prop !== 'modelValue') {
      props[prop] = props.modelValue
      delete props.modelValue
    }
    // important: update dynamic props
    if (dynamicProps) {
      dynamicProps[dynamicProps.indexOf('modelValue')] = prop
    }
    props[compatModelEventPrefix + event] = props['onUpdate:modelValue']
    delete props['onUpdate:modelValue']
  }
}


function applyModelFromMixins(model: any, mixins?: ComponentOptions[]) {
  if (mixins) {
    mixins.forEach(m => {
      if (m.model) extend(model, m.model)
      if (m.mixins) applyModelFromMixins(model, m.mixins)
    })
  }
}

/**
 * #1156
 * When a component is HMR-enabled, we need to make sure that all static nodes
 * inside a block also inherit the DOM element from the previous tree so that
 * HMR updates (which are full updates) can retrieve the element for patching.
 *
 * #2080
 * Inside keyed `template` fragment static children, if a fragment is moved,
 * the children will always be moved. Therefore, in order to ensure correct move
 * position, el should be inherited from previous nodes.
 */
export function traverseStaticChildren(
  n1: VNode,
  n2: VNode,
  shallow = false,
): void {
  const ch1 = n1.children
  const ch2 = n2.children
  if (isArray(ch1) && isArray(ch2)) {
    for (let i = 0; i < ch1.length; i++) {
      // this is only called in the optimized path so array children are
      // guaranteed to be vnodes
      const c1 = ch1[i] as VNode
      let c2 = ch2[i] as VNode
      if (c2.shapeFlag & ShapeFlags.ELEMENT && !c2.dynamicChildren) {
        if (c2.patchFlag <= 0 || c2.patchFlag === PatchFlags.NEED_HYDRATION) {
          c2 = ch2[i] = cloneIfMounted(ch2[i] as VNode)
          c2.el = c1.el
        }
        if (!shallow && c2.patchFlag !== PatchFlags.BAIL)
          traverseStaticChildren(c1, c2)
      }
      // #6852 also inherit for text nodes
      if (
        c2.type === Text &&
        // avoid cached text nodes retaining detached dom nodes
        c2.patchFlag !== PatchFlags.CACHED
      ) {
        c2.el = c1.el
      }
      // #2324 also inherit for comment nodes, but not placeholders (e.g. v-if which
      // would have received .el during block patch)
      if (c2.type === Comment && !c2.el) {
        c2.el = c1.el
      }

      if (__DEV__) {
        c2.el && (c2.el.__vnode = c2)
      }
    }
  }
}


function resolveChildrenNamespace(
  { type, props }: VNode,
  currentNamespace: ElementNamespace,
): ElementNamespace {
  return (currentNamespace === 'svg' && type === 'foreignObject') ||
    (currentNamespace === 'mathml' &&
      type === 'annotation-xml' &&
      props &&
      props.encoding &&
      props.encoding.includes('html'))
    ? undefined
    : currentNamespace
}

export const initSlots = (
  instance: ComponentInternalInstance,
  children: VNodeNormalizedChildren,
  optimized: boolean,
): void => {
  const slots = (instance.slots = createInternalObject())
  if (instance.vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    const type = (children as RawSlots)._
    if (type) {
      assignSlots(slots, children as Slots, optimized)
      // make compiler marker non-enumerable
      if (optimized) {
        def(slots, '_', type, true)
      }
    } else {
      normalizeObjectSlots(children as RawSlots, slots, instance)
    }
  } else if (children) {
    normalizeVNodeSlots(instance, children)
  }
}

export function setupComponent(
  instance: ComponentInternalInstance,
  isSSR = false,
  optimized = false,
): Promise<void> | undefined {
  isSSR && setInSSRSetupState(isSSR)

  const { props, children } = instance.vnode
  const isStateful = isStatefulComponent(instance)
  initProps(instance, props, isStateful, isSSR)
  initSlots(instance, children, optimized || isSSR)

  const setupResult = isStateful
    ? setupStatefulComponent(instance, isSSR)
    : undefined

  isSSR && setInSSRSetupState(false)
  return setupResult
}


export function initProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  isStateful: number, // result of bitwise flag comparison
  isSSR = false,
): void {
  const props: Data = {}
  const attrs: Data = createInternalObject()

  instance.propsDefaults = Object.create(null)

  setFullProps(instance, rawProps, props, attrs)

  // ensure all declared prop keys are present
  for (const key in instance.propsOptions[0]) {
    if (!(key in props)) {
      props[key] = undefined
    }
  }

  // validation
  if (__DEV__) {
    validateProps(rawProps || {}, props, instance)
  }

  if (isStateful) {
    // stateful
    instance.props = isSSR ? props : shallowReactive(props)
  } else {
    if (!instance.type.props) {
      // functional w/ optional props, props === attrs
      instance.props = attrs
    } else {
      // functional w/ declared props
      instance.props = props
    }
  }
  instance.attrs = attrs
}


function setFullProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  props: Data,
  attrs: Data,
) {
  const [options, needCastKeys] = instance.propsOptions
  let hasAttrsChanged = false
  let rawCastValues: Data | undefined
  if (rawProps) {
    for (let key in rawProps) {
      // key, ref are reserved and never passed down
      if (isReservedProp(key)) {
        continue
      }

      if (__COMPAT__) {
        if (key.startsWith('onHook:')) {
          softAssertCompatEnabled(
            DeprecationTypes.INSTANCE_EVENT_HOOKS,
            instance,
            key.slice(2).toLowerCase(),
          )
        }
        if (key === 'inline-template') {
          continue
        }
      }

      const value = rawProps[key]
      // prop option names are camelized during normalization, so to support
      // kebab -> camel conversion here we need to camelize the key.
      let camelKey
      if (options && hasOwn(options, (camelKey = camelize(key)))) {
        if (!needCastKeys || !needCastKeys.includes(camelKey)) {
          props[camelKey] = value
        } else {
          ; (rawCastValues || (rawCastValues = {}))[camelKey] = value
        }
      } else if (!isEmitListener(instance.emitsOptions, key)) {
        // Any non-declared (either as a prop or an emitted event) props are put
        // into a separate `attrs` object for spreading. Make sure to preserve
        // original key casing
        if (__COMPAT__) {
          if (isOn(key) && key.endsWith('Native')) {
            key = key.slice(0, -6) // remove Native postfix
          } else if (shouldSkipAttr(key, instance)) {
            continue
          }
        }
        if (!(key in attrs) || value !== attrs[key]) {
          attrs[key] = value
          hasAttrsChanged = true
        }
      }
    }
  }

  if (needCastKeys) {
    const rawCurrentProps = toRaw(props)
    const castValues = rawCastValues || EMPTY_OBJ
    for (let i = 0; i < needCastKeys.length; i++) {
      const key = needCastKeys[i]
      props[key] = resolvePropValue(
        options!,
        rawCurrentProps,
        key,
        castValues[key],
        instance,
        !hasOwn(castValues, key),
      )
    }
  }

  return hasAttrsChanged
}

/**
 * Function for handling a template ref
 */
export function setRef(
  rawRef: VNodeNormalizedRef,
  oldRawRef: VNodeNormalizedRef | null,
  parentSuspense: SuspenseBoundary | null,
  vnode: VNode,
  isUnmount = false,
): void {
  if (isArray(rawRef)) {
    rawRef.forEach((r, i) =>
      setRef(
        r,
        oldRawRef && (isArray(oldRawRef) ? oldRawRef[i] : oldRawRef),
        parentSuspense,
        vnode,
        isUnmount,
      ),
    )
    return
  }

  if (isAsyncWrapper(vnode) && !isUnmount) {
    // #4999 if an async component already resolved and cached by KeepAlive,
    // we need to set the ref to inner component
    if (
      vnode.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE &&
      (vnode.type as ComponentOptions).__asyncResolved &&
      vnode.component!.subTree.component
    ) {
      setRef(rawRef, oldRawRef, parentSuspense, vnode.component!.subTree)
    }

    // otherwise, nothing needs to be done because the template ref
    // is forwarded to inner component
    return
  }

  const refValue =
    vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT
      ? getComponentPublicInstance(vnode.component!)
      : vnode.el
  const value = isUnmount ? null : refValue

  const { i: owner, r: ref } = rawRef
  if (__DEV__ && !owner) {
    warn(
      `Missing ref owner context. ref cannot be used on hoisted vnodes. ` +
      `A vnode with ref must be created inside the render function.`,
    )
    return
  }
  const oldRef = oldRawRef && (oldRawRef as VNodeNormalizedRefAtom).r
  const refs = owner.refs === EMPTY_OBJ ? (owner.refs = {}) : owner.refs
  const setupState = owner.setupState
  const rawSetupState = toRaw(setupState)
  const canSetSetupRef =
    setupState === EMPTY_OBJ
      ? NO
      : (key: string) => {
        if (__DEV__) {
          if (hasOwn(rawSetupState, key) && !isRef(rawSetupState[key])) {
            warn(
              `Template ref "${key}" used on a non-ref value. ` +
              `It will not work in the production build.`,
            )
          }

          if (knownTemplateRefs.has(rawSetupState[key] as any)) {
            return false
          }
        }
        return hasOwn(rawSetupState, key)
      }

  const canSetRef = (ref: VNodeRef) => {
    return !__DEV__ || !knownTemplateRefs.has(ref as any)
  }

  // dynamic ref changed. unset old ref
  if (oldRef != null && oldRef !== ref) {
    if (isString(oldRef)) {
      refs[oldRef] = null
      if (canSetSetupRef(oldRef)) {
        setupState[oldRef] = null
      }
    } else if (isRef(oldRef)) {
      if (canSetRef(oldRef)) {
        oldRef.value = null
      }

      // this type assertion is valid since `oldRef` has already been asserted to be non-null
      const oldRawRefAtom = oldRawRef as VNodeNormalizedRefAtom
      if (oldRawRefAtom.k) refs[oldRawRefAtom.k] = null
    }
  }

  if (isFunction(ref)) {
    callWithErrorHandling(ref, owner, ErrorCodes.FUNCTION_REF, [value, refs])
  } else {
    const _isString = isString(ref)
    const _isRef = isRef(ref)

    if (_isString || _isRef) {
      const doSet = () => {
        if (rawRef.f) {
          const existing = _isString
            ? canSetSetupRef(ref)
              ? setupState[ref]
              : refs[ref]
            : canSetRef(ref) || !rawRef.k
              ? ref.value
              : refs[rawRef.k]
          if (isUnmount) {
            isArray(existing) && remove(existing, refValue)
          } else {
            if (!isArray(existing)) {
              if (_isString) {
                refs[ref] = [refValue]
                if (canSetSetupRef(ref)) {
                  setupState[ref] = refs[ref]
                }
              } else {
                const newVal = [refValue]
                if (canSetRef(ref)) {
                  ref.value = newVal
                }
                if (rawRef.k) refs[rawRef.k] = newVal
              }
            } else if (!existing.includes(refValue)) {
              existing.push(refValue)
            }
          }
        } else if (_isString) {
          refs[ref] = value
          if (canSetSetupRef(ref)) {
            setupState[ref] = value
          }
        } else if (_isRef) {
          if (canSetRef(ref)) {
            ref.value = value
          }
          if (rawRef.k) refs[rawRef.k] = value
        } else if (__DEV__) {
          warn('Invalid template ref type:', ref, `(${typeof ref})`)
        }
      }
      if (value) {
        // #1789: for non-null values, set them after render
        // null values means this is unmount and it should not overwrite another
        // ref with the same key
        ; (doSet as SchedulerJob).id = -1
        queuePostRenderEffect(doSet, parentSuspense)
      } else {
        doSet()
      }
    } else if (__DEV__) {
      warn('Invalid template ref type:', ref, `(${typeof ref})`)
    }
  }
}


export function filterSingleRoot(
  children: VNodeArrayChildren,
  recurse = true,
): VNode | undefined {
  let singleRoot
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (isVNode(child)) {
      // ignore user comment
      if (child.type !== Comment || child.children === 'v-if') {
        if (singleRoot) {
          // has more than 1 non-comment child, return now
          return
        } else {
          singleRoot = child
          if (
            __DEV__ &&
            recurse &&
            singleRoot.patchFlag > 0 &&
            singleRoot.patchFlag & PatchFlags.DEV_ROOT_FRAGMENT
          ) {
            return filterSingleRoot(singleRoot.children as VNodeArrayChildren)
          }
        }
      }
    } else {
      return
    }
  }
  return singleRoot
}


function locateNonHydratedAsyncRoot(
  instance: ComponentInternalInstance,
): ComponentInternalInstance | undefined {
  const subComponent = instance.subTree.component
  if (subComponent) {
    if (subComponent.asyncDep && !subComponent.asyncResolved) {
      return subComponent
    } else {
      return locateNonHydratedAsyncRoot(subComponent)
    }
  }
}

export function needTransition(
  parentSuspense: SuspenseBoundary | null,
  transition: TransitionHooks | null,
): boolean | null {
  return (
    (!parentSuspense || (parentSuspense && !parentSuspense.pendingBranch)) &&
    transition &&
    !transition.persisted
  )
}


export function shouldUpdateComponent(
  prevVNode: VNode,
  nextVNode: VNode,
  optimized?: boolean,
): boolean {
  const { props: prevProps, children: prevChildren, component } = prevVNode
  const { props: nextProps, children: nextChildren, patchFlag } = nextVNode
  const emits = component!.emitsOptions

  // Parent component's render function was hot-updated. Since this may have
  // caused the child component's slots content to have changed, we need to
  // force the child to update as well.
  if (__DEV__ && (prevChildren || nextChildren) && isHmrUpdating) {
    return true
  }

  // force child update for runtime directive or transition on component vnode.
  if (nextVNode.dirs || nextVNode.transition) {
    return true
  }

  if (optimized && patchFlag >= 0) {
    if (patchFlag & PatchFlags.DYNAMIC_SLOTS) {
      // slot content that references values that might have changed,
      // e.g. in a v-for
      return true
    }
    if (patchFlag & PatchFlags.FULL_PROPS) {
      if (!prevProps) {
        return !!nextProps
      }
      // presence of this flag indicates props are always non-null
      return hasPropsChanged(prevProps, nextProps!, emits)
    } else if (patchFlag & PatchFlags.PROPS) {
      const dynamicProps = nextVNode.dynamicProps!
      for (let i = 0; i < dynamicProps.length; i++) {
        const key = dynamicProps[i]
        if (
          nextProps![key] !== prevProps![key] &&
          !isEmitListener(emits, key)
        ) {
          return true
        }
      }
    }
  } else {
    // this path is only taken by manually written render functions
    // so presence of any children leads to a forced update
    if (prevChildren || nextChildren) {
      if (!nextChildren || !(nextChildren as any).$stable) {
        return true
      }
    }
    if (prevProps === nextProps) {
      return false
    }
    if (!prevProps) {
      return !!nextProps
    }
    if (!nextProps) {
      return true
    }
    return hasPropsChanged(prevProps, nextProps, emits)
  }

  return false
}


export function registerHMR(instance: ComponentInternalInstance): void {
  const id = instance.type.__hmrId!
  let record = map.get(id)
  if (!record) {
    createRecord(id, instance.type as HMRComponent)
    record = map.get(id)!
  }
  record.instances.add(instance)
}

function createRecord(id: string, initialDef: HMRComponent): boolean {
  if (map.has(id)) {
    return false
  }
  map.set(id, {
    initialDef: normalizeClassComponent(initialDef),
    instances: new Set(),
  })
  return true
}

export function createPathGetter(ctx: any, path: string) {
  const segments = path.split('.')
  return (): any => {
    let cur = ctx
    for (let i = 0; i < segments.length && cur; i++) {
      cur = cur[segments[i]]
    }
    return cur
  }
}


function normalizeClassComponent(component: HMRComponent): ComponentOptions {
  return isClassComponent(component) ? component.__vccOpts : component
}

export const useSSRContext = <T = Record<string, any>>(): T | undefined => {
  if (!__GLOBAL__) {
    const ctx = inject<T>(ssrContextKey)
    if (!ctx) {
      __DEV__ &&
        warn(
          `Server rendering context not provided. Make sure to only call ` +
          `useSSRContext() conditionally in the server build.`,
        )
    }
    return ctx
  } else if (__DEV__) {
    warn(`useSSRContext() is not supported in the global build.`)
  }
}


function doWatch(
  source: WatchSource | WatchSource[] | WatchEffect | object,
  cb: WatchCallback | null,
  options: WatchAPIOptions = EMPTY_OBJ,
): WatchHandle {
  const { immediate, deep, flush, once } = options

  if (__DEV__ && !cb) {
    if (immediate !== undefined) {
      warn(
        `watch() "immediate" option is only respected when using the ` +
        `watch(source, callback, options?) signature.`,
      )
    }
    if (deep !== undefined) {
      warn(
        `watch() "deep" option is only respected when using the ` +
        `watch(source, callback, options?) signature.`,
      )
    }
    if (once !== undefined) {
      warn(
        `watch() "once" option is only respected when using the ` +
        `watch(source, callback, options?) signature.`,
      )
    }
  }

  const baseWatchOptions: BaseWatchOptions = extend({}, options)

  if (__DEV__) baseWatchOptions.onWarn = warn




  // immediate watcher or watchEffect
  const runsImmediately = (cb && immediate) || (!cb && flush !== 'post')
  let ssrCleanup: (() => void)[] | undefined
  if (__SSR__ && isInSSRComponentSetup) {
    if (flush === 'sync') {
      const ctx = useSSRContext()!
      ssrCleanup = ctx.__watcherHandles || (ctx.__watcherHandles = [])
    } else if (!runsImmediately) {
      const watchStopHandle = () => { }
      watchStopHandle.stop = NOOP
      watchStopHandle.resume = NOOP
      watchStopHandle.pause = NOOP
      return watchStopHandle
    }
  }

  const instance = currentInstance
  baseWatchOptions.call = (fn, type, args) =>
    callWithAsyncErrorHandling(fn, instance, type, args)

  // scheduler
  let isPre = false
  if (flush === 'post') {
    baseWatchOptions.scheduler = job => {
      queuePostRenderEffect(job, instance && instance.suspense)
    }
  } else if (flush !== 'sync') {
    // default: 'pre'
    isPre = true
    baseWatchOptions.scheduler = (job, isFirstRun) => {
      if (isFirstRun) {
        job()
      } else {
        queueJob(job)
      }
    }
  }

  baseWatchOptions.augmentJob = (job: SchedulerJob) => {
    // important: mark the job as a watcher callback so that scheduler knows
    // it is allowed to self-trigger (#1727)
    if (cb) {
      job.flags! |= SchedulerJobFlags.ALLOW_RECURSE
    }
    if (isPre) {
      job.flags! |= SchedulerJobFlags.PRE
      if (instance) {
        job.id = instance.uid
          ; (job as SchedulerJob).i = instance
      }
    }
  }

  const watchHandle = baseWatch(source, cb, baseWatchOptions)

  if (__SSR__ && isInSSRComponentSetup) {
    if (ssrCleanup) {
      ssrCleanup.push(watchHandle)
    } else if (runsImmediately) {
      watchHandle()
    }
  }

  return watchHandle
}


function patchSuspense(
  n1: VNode,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  namespace: ElementNamespace,
  slotScopeIds: string[] | null,
  optimized: boolean,
  { p: patch, um: unmount, o: { createElement } }: RendererInternals,
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
      // same root type but content may have changed.
      patch(
        pendingBranch,
        newBranch,
        suspense.hiddenContainer,
        null,
        parentComponent,
        suspense,
        namespace,
        slotScopeIds,
        optimized,
      )
      if (suspense.deps <= 0) {
        suspense.resolve()
      } else if (isInFallback) {
        // It's possible that the app is in hydrating state when patching the
        // suspense instance. If someone updates the dependency during component
        // setup in children of suspense boundary, that would be problemtic
        // because we aren't actually showing a fallback content when
        // patchSuspense is called. In such case, patch of fallback content
        // should be no op
        if (!isHydrating) {
          patch(
            activeBranch,
            newFallback,
            container,
            anchor,
            parentComponent,
            null, // fallback tree will not have suspense context
            namespace,
            slotScopeIds,
            optimized,
          )
          setActiveBranch(suspense, newFallback)
        }
      }
    } else {
      // toggled before pending tree is resolved
      // increment pending ID. this is used to invalidate async callbacks
      suspense.pendingId = suspenseId++
      if (isHydrating) {
        // if toggled before hydration is finished, the current DOM tree is
        // no longer valid. set it as the active branch so it will be unmounted
        // when resolved
        suspense.isHydrating = false
        suspense.activeBranch = pendingBranch
      } else {
        unmount(pendingBranch, parentComponent, suspense)
      }
      // reset suspense state
      suspense.deps = 0
      // discard effects from pending branch
      suspense.effects.length = 0
      // discard previous container
      suspense.hiddenContainer = createElement('div')

      if (isInFallback) {
        // already in fallback state
        patch(
          null,
          newBranch,
          suspense.hiddenContainer,
          null,
          parentComponent,
          suspense,
          namespace,
          slotScopeIds,
          optimized,
        )
        if (suspense.deps <= 0) {
          suspense.resolve()
        } else {
          patch(
            activeBranch,
            newFallback,
            container,
            anchor,
            parentComponent,
            null, // fallback tree will not have suspense context
            namespace,
            slotScopeIds,
            optimized,
          )
          setActiveBranch(suspense, newFallback)
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
          namespace,
          slotScopeIds,
          optimized,
        )
        // force resolve
        suspense.resolve(true)
      } else {
        // switched to a 3rd branch
        patch(
          null,
          newBranch,
          suspense.hiddenContainer,
          null,
          parentComponent,
          suspense,
          namespace,
          slotScopeIds,
          optimized,
        )
        if (suspense.deps <= 0) {
          suspense.resolve()
        }
      }
    }
  } else {
    if (activeBranch && isSameVNodeType(newBranch, activeBranch)) {
      // root did not change, just normal patch
      patch(
        activeBranch,
        newBranch,
        container,
        anchor,
        parentComponent,
        suspense,
        namespace,
        slotScopeIds,
        optimized,
      )
      setActiveBranch(suspense, newBranch)
    } else {
      // root node toggled
      // invoke @pending event
      triggerEvent(n2, 'onPending')
      // mount pending branch in off-dom container
      suspense.pendingBranch = newBranch
      if (newBranch.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
        suspense.pendingId = newBranch.component!.suspenseId!
      } else {
        suspense.pendingId = suspenseId++
      }
      patch(
        null,
        newBranch,
        suspense.hiddenContainer,
        null,
        parentComponent,
        suspense,
        namespace,
        slotScopeIds,
        optimized,
      )
      if (suspense.deps <= 0) {
        // incoming branch has no async deps, resolve now.
        suspense.resolve()
      } else {
        const { timeout, pendingId } = suspense
        if (timeout > 0) {
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


function setActiveBranch(suspense: SuspenseBoundary, branch: VNode) {
  suspense.activeBranch = branch
  const { vnode, parentComponent } = suspense
  let el = branch.el
  // if branch has no el after patch, it's a HOC wrapping async components
  // drill and locate the placeholder comment node
  while (!el && branch.component) {
    branch = branch.component.subTree
    el = branch.el
  }
  vnode.el = el
  // in case suspense is the root node of a component,
  // recursively update the HOC el
  if (parentComponent && parentComponent.subTree === vnode) {
    parentComponent.vnode.el = el
    updateHOCHostEl(parentComponent, el)
  }
}

function triggerEvent(
  vnode: VNode,
  name: 'onResolve' | 'onPending' | 'onFallback',
) {
  const eventListener = vnode.props && vnode.props[name]
  if (isFunction(eventListener)) {
    eventListener()
  }
}

export function mergeOptions(
  to: any,
  from: any,
  strats: Record<string, OptionMergeFunction>,
  asMixin = false,
): any {
  if (__COMPAT__ && isFunction(from)) {
    from = from.options
  }

  const { mixins, extends: extendsOptions } = from

  if (extendsOptions) {
    mergeOptions(to, extendsOptions, strats, true)
  }
  if (mixins) {
    mixins.forEach((m: ComponentOptionsMixin) =>
      mergeOptions(to, m, strats, true),
    )
  }

  for (const key in from) {
    if (asMixin && key === 'expose') {
      __DEV__ &&
        warn(
          `"expose" option is ignored when declared in mixins or extends. ` +
          `It should only be declared in the base component itself.`,
        )
    } else {
      const strat = internalOptionMergeStrats[key] || (strats && strats[key])
      to[key] = strat ? strat(to[key], from[key]) : from[key]
    }
  }
  return to
}

function mergeDataFn(to: any, from: any) {
  if (!from) {
    return to
  }
  if (!to) {
    return from
  }
  return function mergedDataFn(this: ComponentPublicInstance) {
    return (
      __COMPAT__ && isCompatEnabled(DeprecationTypes.OPTIONS_DATA_MERGE, null)
        ? deepMergeData
        : extend
    )(
      isFunction(to) ? to.call(this, this) : to,
      isFunction(from) ? from.call(this, this) : from,
    )
  }
}

function mergeEmitsOrPropsOptions(
  to: EmitsOptions | undefined,
  from: EmitsOptions | undefined,
): EmitsOptions | undefined
function mergeEmitsOrPropsOptions(
  to: ComponentPropsOptions | undefined,
  from: ComponentPropsOptions | undefined,
): ComponentPropsOptions | undefined
function mergeEmitsOrPropsOptions(
  to: ComponentPropsOptions | EmitsOptions | undefined,
  from: ComponentPropsOptions | EmitsOptions | undefined,
) {
  if (to) {
    if (isArray(to) && isArray(from)) {
      return [...new Set([...to, ...from])]
    }
    return extend(
      Object.create(null),
      normalizePropsOrEmits(to),
      normalizePropsOrEmits(from ?? {}),
    )
  } else {
    return from
  }
}

/**
 * @internal
 */
export function normalizePropsOrEmits(
  props: ComponentPropsOptions | EmitsOptions,
): ComponentObjectPropsOptions | ObjectEmitsOptions {
  return isArray(props)
    ? props.reduce(
      (normalized, p) => ((normalized[p] = null), normalized),
      {} as ComponentObjectPropsOptions | ObjectEmitsOptions,
    )
    : props
}

function mergeObjectOptions(to: object | undefined, from: object | undefined) {
  return to ? extend(Object.create(null), to, from) : from
}

function mergeAsArray<T = Function>(to: T[] | T | undefined, from: T | T[]) {
  return to ? [...new Set([].concat(to as any, from as any))] : from
}
function mergeWatchOptions(
  to: ComponentWatchOptions | undefined,
  from: ComponentWatchOptions | undefined,
) {
  if (!to) return from
  if (!from) return to
  const merged = extend(Object.create(null), to)
  for (const key in from) {
    merged[key] = mergeAsArray(to[key], from[key])
  }
  return merged
}
function mergeInject(
  to: ComponentInjectOptions | undefined,
  from: ComponentInjectOptions,
) {
  return mergeObjectOptions(normalizeInject(to), normalizeInject(from))
}

function normalizeInject(
  raw: ComponentInjectOptions | undefined,
): ObjectInjectOptions | undefined {
  if (isArray(raw)) {
    const res: ObjectInjectOptions = {}
    for (let i = 0; i < raw.length; i++) {
      res[raw[i]] = raw[i]
    }
    return res
  }
  return raw
}

export const internalOptionMergeStrats: Record<string, Function> = {
  data: mergeDataFn,
  props: mergeEmitsOrPropsOptions,
  emits: mergeEmitsOrPropsOptions,
  // objects
  methods: mergeObjectOptions,
  computed: mergeObjectOptions,
  // lifecycle
  beforeCreate: mergeAsArray,
  created: mergeAsArray,
  beforeMount: mergeAsArray,
  mounted: mergeAsArray,
  beforeUpdate: mergeAsArray,
  updated: mergeAsArray,
  beforeDestroy: mergeAsArray,
  beforeUnmount: mergeAsArray,
  destroyed: mergeAsArray,
  unmounted: mergeAsArray,
  activated: mergeAsArray,
  deactivated: mergeAsArray,
  errorCaptured: mergeAsArray,
  serverPrefetch: mergeAsArray,
  // assets
  components: mergeObjectOptions,
  directives: mergeObjectOptions,
  // watch
  watch: mergeWatchOptions,
  // provide / inject
  provide: mergeDataFn,
  inject: mergeInject,
}


export function initFeatureFlags(): void {
  const needWarn = []

  if (typeof __FEATURE_OPTIONS_API__ !== 'boolean') {
    __DEV__ && needWarn.push(`__VUE_OPTIONS_API__`)
    getGlobalThis().__VUE_OPTIONS_API__ = true
  }

  if (typeof __FEATURE_PROD_DEVTOOLS__ !== 'boolean') {
    __DEV__ && needWarn.push(`__VUE_PROD_DEVTOOLS__`)
    getGlobalThis().__VUE_PROD_DEVTOOLS__ = false
  }

  if (typeof __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__ !== 'boolean') {
    __DEV__ && needWarn.push(`__VUE_PROD_HYDRATION_MISMATCH_DETAILS__`)
    getGlobalThis().__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = false
  }

  if (__DEV__ && needWarn.length) {
    const multi = needWarn.length > 1
    console.warn(
      `Feature flag${multi ? `s` : ``} ${needWarn.join(', ')} ${multi ? `are` : `is`
      } not explicitly defined. You are running the esm-bundler build of Vue, ` +
      `which expects these compile-time feature flags to be globally injected ` +
      `via the bundler config in order to get better tree-shaking in the ` +
      `production bundle.\n\n` +
      `For more details, see https://link.vuejs.org/feature-flags.`,
    )
  }
}

export function setDevtoolsHook(hook: DevtoolsHook, target: any): void {
  devtools = hook
  if (devtools) {
    devtools.enabled = true
    buffer.forEach(({ event, args }) => devtools.emit(event, ...args))
    buffer = []
  } else if (
    // handle late devtools injection - only do this if we are in an actual
    // browser environment to avoid the timer handle stalling test runner exit
    // (#4815)
    typeof window !== 'undefined' &&
    // some envs mock window but not fully
    window.HTMLElement &&
    // also exclude jsdom
    // eslint-disable-next-line no-restricted-syntax
    !window.navigator?.userAgent?.includes('jsdom')
  ) {
    const replay = (target.__VUE_DEVTOOLS_HOOK_REPLAY__ =
      target.__VUE_DEVTOOLS_HOOK_REPLAY__ || [])
    replay.push((newHook: DevtoolsHook) => {
      setDevtoolsHook(newHook, target)
    })
    // clear buffer after 3s - the user probably doesn't have devtools installed
    // at all, and keeping the buffer will cause memory leaks (#4738)
    setTimeout(() => {
      if (!devtools) {
        target.__VUE_DEVTOOLS_HOOK_REPLAY__ = null
        devtoolsNotInstalled = true
        buffer = []
      }
    }, 3000)
  } else {
    // non-browser env, assume not installed
    devtoolsNotInstalled = true
    buffer = []
  }
}



function mountSuspense(
  vnode: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  namespace: ElementNamespace,
  slotScopeIds: string[] | null,
  optimized: boolean,
  rendererInternals: RendererInternals,
) {
  const {
    p: patch,
    o: { createElement },
  } = rendererInternals
  const hiddenContainer = createElement('div')
  const suspense = (vnode.suspense = createSuspenseBoundary(
    vnode,
    parentSuspense,
    parentComponent,
    container,
    hiddenContainer,
    anchor,
    namespace,
    slotScopeIds,
    optimized,
    rendererInternals,
  ))

  // start mounting the content subtree in an off-dom container
  patch(
    null,
    (suspense.pendingBranch = vnode.ssContent!),
    hiddenContainer,
    null,
    parentComponent,
    suspense,
    namespace,
    slotScopeIds,
  )
  // now check if we have encountered any async deps
  if (suspense.deps > 0) {
    // has async
    // invoke @fallback event
    triggerEvent(vnode, 'onPending')
    triggerEvent(vnode, 'onFallback')

    // mount the fallback tree
    patch(
      null,
      vnode.ssFallback!,
      container,
      anchor,
      parentComponent,
      null, // fallback tree will not have suspense context
      namespace,
      slotScopeIds,
    )
    setActiveBranch(suspense, vnode.ssFallback!)
  } else {
    // Suspense has no async deps. Just resolve.
    suspense.resolve(false, true)
  }
}


function createSuspenseBoundary(
  vnode: VNode,
  parentSuspense: SuspenseBoundary | null,
  parentComponent: ComponentInternalInstance | null,
  container: RendererElement,
  hiddenContainer: RendererElement,
  anchor: RendererNode | null,
  namespace: ElementNamespace,
  slotScopeIds: string[] | null,
  optimized: boolean,
  rendererInternals: RendererInternals,
  isHydrating = false,
): SuspenseBoundary {
  /* v8 ignore start */
  if (__DEV__ && !__TEST__ && !hasWarned) {
    hasWarned = true
    // @ts-expect-error `console.info` cannot be null error
    // eslint-disable-next-line no-console
    console[console.info ? 'info' : 'log'](
      `<Suspense> is an experimental feature and its API will likely change.`,
    )
  }
  /* v8 ignore stop */

  const {
    p: patch,
    m: move,
    um: unmount,
    n: next,
    o: { parentNode, remove },
  } = rendererInternals

  // if set `suspensible: true`, set the current suspense as a dep of parent suspense
  let parentSuspenseId: number | undefined
  const isSuspensible = isVNodeSuspensible(vnode)
  if (isSuspensible) {
    if (parentSuspense && parentSuspense.pendingBranch) {
      parentSuspenseId = parentSuspense.pendingId
      parentSuspense.deps++
    }
  }

  const timeout = vnode.props ? toNumber(vnode.props.timeout) : undefined
  if (__DEV__) {
    assertNumber(timeout, `Suspense timeout`)
  }

  const initialAnchor = anchor
  const suspense: SuspenseBoundary = {
    vnode,
    parent: parentSuspense,
    parentComponent,
    namespace,
    container,
    hiddenContainer,
    deps: 0,
    pendingId: suspenseId++,
    timeout: typeof timeout === 'number' ? timeout : -1,
    activeBranch: null,
    pendingBranch: null,
    isInFallback: !isHydrating,
    isHydrating,
    isUnmounted: false,
    effects: [],

    resolve(resume = false, sync = false) {
      if (__DEV__) {
        if (!resume && !suspense.pendingBranch) {
          throw new Error(
            `suspense.resolve() is called without a pending branch.`,
          )
        }
        if (suspense.isUnmounted) {
          throw new Error(
            `suspense.resolve() is called on an already unmounted suspense boundary.`,
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
        container,
      } = suspense

      // if there's a transition happening we need to wait it to finish.
      let delayEnter: boolean | null = false
      if (suspense.isHydrating) {
        suspense.isHydrating = false
      } else if (!resume) {
        delayEnter =
          activeBranch &&
          pendingBranch!.transition &&
          pendingBranch!.transition.mode === 'out-in'
        if (delayEnter) {
          activeBranch!.transition!.afterLeave = () => {
            if (pendingId === suspense.pendingId) {
              move(
                pendingBranch!,
                container,
                anchor === initialAnchor ? next(activeBranch!) : anchor,
                MoveType.ENTER,
              )
              queuePostFlushCb(effects)
            }
          }
        }
        // unmount current active tree
        if (activeBranch) {
          // if the fallback tree was mounted, it may have been moved
          // as part of a parent suspense. get the latest anchor for insertion
          // #8105 if `delayEnter` is true, it means that the mounting of
          // `activeBranch` will be delayed. if the branch switches before
          // transition completes, both `activeBranch` and `pendingBranch` may
          // coexist in the `hiddenContainer`. This could result in
          // `next(activeBranch!)` obtaining an incorrect anchor
          // (got `pendingBranch.el`).
          // Therefore, after the mounting of activeBranch is completed,
          // it is necessary to get the latest anchor.
          if (parentNode(activeBranch.el!) === container) {
            anchor = next(activeBranch)
          }
          unmount(activeBranch, parentComponent, suspense, true)
        }
        if (!delayEnter) {
          // move content from off-dom container to actual container
          move(pendingBranch!, container, anchor, MoveType.ENTER)
        }
      }

      setActiveBranch(suspense, pendingBranch!)
      suspense.pendingBranch = null
      suspense.isInFallback = false

      // flush buffered effects
      // check if there is a pending parent suspense
      let parent = suspense.parent
      let hasUnresolvedAncestor = false
      while (parent) {
        if (parent.pendingBranch) {
          // found a pending parent suspense, merge buffered post jobs
          // into that parent
          parent.effects.push(...effects)
          hasUnresolvedAncestor = true
          break
        }
        parent = parent.parent
      }
      // no pending parent suspense nor transition, flush all jobs
      if (!hasUnresolvedAncestor && !delayEnter) {
        queuePostFlushCb(effects)
      }
      suspense.effects = []

      // resolve parent suspense if all async deps are resolved
      if (isSuspensible) {
        if (
          parentSuspense &&
          parentSuspense.pendingBranch &&
          parentSuspenseId === parentSuspense.pendingId
        ) {
          parentSuspense.deps--
          if (parentSuspense.deps === 0 && !sync) {
            parentSuspense.resolve()
          }
        }
      }

      // invoke @resolve event
      triggerEvent(vnode, 'onResolve')
    },

    fallback(fallbackVNode) {
      if (!suspense.pendingBranch) {
        return
      }

      const { vnode, activeBranch, parentComponent, container, namespace } =
        suspense

      // invoke @fallback event
      triggerEvent(vnode, 'onFallback')

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
          null, // fallback tree will not have suspense context
          namespace,
          slotScopeIds,
          optimized,
        )
        setActiveBranch(suspense, fallbackVNode)
      }

      const delayEnter =
        fallbackVNode.transition && fallbackVNode.transition.mode === 'out-in'
      if (delayEnter) {
        activeBranch!.transition!.afterLeave = mountFallback
      }
      suspense.isInFallback = true

      // unmount current active branch
      unmount(
        activeBranch!,
        parentComponent,
        null, // no suspense so unmount hooks fire now
        true, // shouldRemove
      )

      if (!delayEnter) {
        mountFallback()
      }
    },

    move(container, anchor, type) {
      suspense.activeBranch &&
        move(suspense.activeBranch, container, anchor, type)
      suspense.container = container
    },

    next() {
      return suspense.activeBranch && next(suspense.activeBranch)
    },

    registerDep(instance, setupRenderEffect, optimized) {
      const isInPendingSuspense = !!suspense.pendingBranch
      if (isInPendingSuspense) {
        suspense.deps++
      }
      const hydratedEl = instance.vnode.el
      instance
        .asyncDep!.catch(err => {
          handleError(err, instance, ErrorCodes.SETUP_FUNCTION)
        })
        .then(asyncSetupResult => {
          // retry when the setup() promise resolves.
          // component may have been unmounted before resolve.
          if (
            instance.isUnmounted ||
            suspense.isUnmounted ||
            suspense.pendingId !== instance.suspenseId
          ) {
            return
          }
          // retry from this component
          instance.asyncResolved = true
          const { vnode } = instance
          if (__DEV__) {
            pushWarningContext(vnode)
          }
          handleSetupResult(instance, asyncSetupResult, false)
          if (hydratedEl) {
            // vnode may have been replaced if an update happened before the
            // async dep is resolved.
            vnode.el = hydratedEl
          }
          const placeholder = !hydratedEl && instance.subTree.el
          setupRenderEffect(
            instance,
            vnode,
            // component may have been moved before resolve.
            // if this is not a hydration, instance.subTree will be the comment
            // placeholder.
            parentNode(hydratedEl || instance.subTree.el!)!,
            // anchor will not be used if this is hydration, so only need to
            // consider the comment placeholder case.
            hydratedEl ? null : next(instance.subTree),
            suspense,
            namespace,
            optimized,
          )
          if (placeholder) {
            remove(placeholder)
          }
          updateHOCHostEl(instance, vnode.el)
          if (__DEV__) {
            popWarningContext()
          }
          // only decrease deps count if suspense is not already resolved
          if (isInPendingSuspense && --suspense.deps === 0) {
            suspense.resolve()
          }
        })
    },

    unmount(parentSuspense, doRemove) {
      suspense.isUnmounted = true
      if (suspense.activeBranch) {
        unmount(
          suspense.activeBranch,
          parentComponent,
          parentSuspense,
          doRemove,
        )
      }
      if (suspense.pendingBranch) {
        unmount(
          suspense.pendingBranch,
          parentComponent,
          parentSuspense,
          doRemove,
        )
      }
    },
  }

  return suspense
}


function hydrateSuspense(
  node: Node,
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  namespace: ElementNamespace,
  slotScopeIds: string[] | null,
  optimized: boolean,
  rendererInternals: RendererInternals,
  hydrateNode: (
    node: Node,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    slotScopeIds: string[] | null,
    optimized: boolean,
  ) => Node | null,
): Node | null {
  const suspense = (vnode.suspense = createSuspenseBoundary(
    vnode,
    parentSuspense,
    parentComponent,
    node.parentNode!,
    // eslint-disable-next-line no-restricted-globals
    document.createElement('div'),
    null,
    namespace,
    slotScopeIds,
    optimized,
    rendererInternals,
    true /* hydrating */,
  ))
  // there are two possible scenarios for server-rendered suspense:
  // - success: ssr content should be fully resolved
  // - failure: ssr content should be the fallback branch.
  // however, on the client we don't really know if it has failed or not
  // attempt to hydrate the DOM assuming it has succeeded, but we still
  // need to construct a suspense boundary first
  const result = hydrateNode(
    node,
    (suspense.pendingBranch = vnode.ssContent!),
    parentComponent,
    suspense,
    slotScopeIds,
    optimized,
  )
  if (suspense.deps === 0) {
    suspense.resolve(false, true)
  }
  return result
}


function normalizeSuspenseChildren(vnode: VNode): void {
  const { shapeFlag, children } = vnode
  const isSlotChildren = shapeFlag & ShapeFlags.SLOTS_CHILDREN
  vnode.ssContent = normalizeSuspenseSlot(
    isSlotChildren ? (children as Slots).default : children,
  )

  vnode.ssFallback = isSlotChildren
    ? normalizeSuspenseSlot((children as Slots).fallback)
    : createVNode(Comment)
}

function normalizeSuspenseSlot(s: any) {
  let block: VNode[] | null | undefined
  if (isFunction(s)) {
    const trackBlock = isBlockTreeEnabled && s._c
    if (trackBlock) {
      // disableTracking: false
      // allow block tracking for compiled slots
      // (see ./componentRenderContext.ts)
      s._d = false
      openBlock()
    }
    s = s()
    if (trackBlock) {
      s._d = true
      block = currentBlock
      closeBlock()
    }
  }
  if (isArray(s)) {
    const singleChild = filterSingleRoot(s)
    if (
      __DEV__ &&
      !singleChild &&
      s.filter(child => child !== NULL_DYNAMIC_COMPONENT).length > 0
    ) {
      warn(`<Suspense> slots expect a single root node.`)
    }
    s = singleChild
  }
  s = normalizeVNode(s)
  if (block && !s.dynamicChildren) {
    s.dynamicChildren = block.filter(c => c !== s)
  }
  return s
}


// https://en.wikipedia.org/wiki/Longest_increasing_subsequence
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
        c = (u + v) >> 1
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
const normalizedAsyncComponentMap = new WeakMap<
  LegacyAsyncComponent,
  Component
>()

/*! #__NO_SIDE_EFFECTS__ */
export function defineAsyncComponent<
  T extends Component = { new(): ComponentPublicInstance },
>(source: AsyncComponentLoader<T> | AsyncComponentOptions<T>): T {
  if (isFunction(source)) {
    source = { loader: source }
  }

  const {
    loader,
    loadingComponent,
    errorComponent,
    delay = 200,
    hydrate: hydrateStrategy,
    timeout, // undefined = never times out
    suspensible = true,
    onError: userOnError,
  } = source

  let pendingRequest: Promise<ConcreteComponent> | null = null
  let resolvedComp: ConcreteComponent | undefined

  let retries = 0
  const retry = () => {
    retries++
    pendingRequest = null
    return load()
  }

  const load = (): Promise<ConcreteComponent> => {
    let thisRequest: Promise<ConcreteComponent>
    return (
      pendingRequest ||
      (thisRequest = pendingRequest =
        loader()
          .catch(err => {
            err = err instanceof Error ? err : new Error(String(err))
            if (userOnError) {
              return new Promise((resolve, reject) => {
                const userRetry = () => resolve(retry())
                const userFail = () => reject(err)
                userOnError(err, userRetry, userFail, retries + 1)
              })
            } else {
              throw err
            }
          })
          .then((comp: any) => {
            if (thisRequest !== pendingRequest && pendingRequest) {
              return pendingRequest
            }
            if (__DEV__ && !comp) {
              warn(
                `Async component loader resolved to undefined. ` +
                `If you are using retry(), make sure to return its return value.`,
              )
            }
            // interop module default
            if (
              comp &&
              (comp.__esModule || comp[Symbol.toStringTag] === 'Module')
            ) {
              comp = comp.default
            }
            if (__DEV__ && comp && !isObject(comp) && !isFunction(comp)) {
              throw new Error(`Invalid async component load result: ${comp}`)
            }
            resolvedComp = comp
            return comp
          }))
    )
  }

  return defineComponent({
    name: 'AsyncComponentWrapper',

    __asyncLoader: load,

    __asyncHydrate(el, instance, hydrate) {
      let patched = false
        ; (instance.bu || (instance.bu = [])).push(() => (patched = true))
      const performHydrate = () => {
        // skip hydration if the component has been patched
        if (patched) {
          if (__DEV__) {
            warn(
              `Skipping lazy hydration for component '${getComponentName(resolvedComp!) || resolvedComp!.__file}': ` +
              `it was updated before lazy hydration performed.`,
            )
          }
          return
        }
        hydrate()
      }
      const doHydrate = hydrateStrategy
        ? () => {
          const teardown = hydrateStrategy(performHydrate, cb =>
            forEachElement(el, cb),
          )
          if (teardown) {
            ; (instance.bum || (instance.bum = [])).push(teardown)
          }
        }
        : performHydrate
      if (resolvedComp) {
        doHydrate()
      } else {
        load().then(() => !instance.isUnmounted && doHydrate())
      }
    },

    get __asyncResolved() {
      return resolvedComp
    },

    setup() {
      const instance = currentInstance!
      markAsyncBoundary(instance)

      // already resolved
      if (resolvedComp) {
        return () => createInnerComp(resolvedComp!, instance)
      }

      const onError = (err: Error) => {
        pendingRequest = null
        handleError(
          err,
          instance,
          ErrorCodes.ASYNC_COMPONENT_LOADER,
          !errorComponent /* do not throw in dev if user provided error component */,
        )
      }

      // suspense-controlled or SSR.
      if (
        (__FEATURE_SUSPENSE__ && suspensible && instance.suspense) ||
        (__SSR__ && isInSSRComponentSetup)
      ) {
        return load()
          .then(comp => {
            return () => createInnerComp(comp, instance)
          })
          .catch(err => {
            onError(err)
            return () => {

              return errorComponent
                ? createVNode(errorComponent as ConcreteComponent, {
                  error: err,
                })
                : null
            }
          })
      }

      const loaded = ref(false)
      const error = ref()
      const delayed = ref(!!delay)

      if (delay) {
        setTimeout(() => {
          delayed.value = false
        }, delay)
      }

      if (timeout != null) {
        setTimeout(() => {
          if (!loaded.value && !error.value) {
            const err = new Error(
              `Async component timed out after ${timeout}ms.`,
            )
            onError(err)
            error.value = err
          }
        }, timeout)
      }

      load()
        .then(() => {
          loaded.value = true
          if (instance.parent && isKeepAlive(instance.parent.vnode)) {
            // parent is keep-alive, force update so the loaded component's
            // name is taken into account
            instance.parent.update()
          }
        })
        .catch(err => {
          onError(err)
          error.value = err
        })

      return () => {
        if (loaded.value && resolvedComp) {
          return createInnerComp(resolvedComp, instance)
        } else if (error.value && errorComponent) {

          return createVNode(errorComponent, {
            error: error.value,
          })
        } else if (loadingComponent && !delayed.value) {

          return createVNode(loadingComponent)
        }
      }
    },
  }) as T
}


export function convertLegacyAsyncComponent(
  comp: LegacyAsyncComponent,
): Component {
  if (normalizedAsyncComponentMap.has(comp)) {
    return normalizedAsyncComponentMap.get(comp)!
  }

  // we have to call the function here due to how v2's API won't expose the
  // options until we call it
  let resolve: (res: LegacyAsyncReturnValue) => void
  let reject: (reason?: any) => void
  const fallbackPromise = new Promise<Component>((r, rj) => {
    ; (resolve = r), (reject = rj)
  })

  const res = comp(resolve!, reject!)

  let converted: Component
  if (isPromise(res)) {
    converted = defineAsyncComponent(() => res)
  } else if (isObject(res) && !isVNode(res) && !isArray(res)) {
    converted = defineAsyncComponent({
      loader: () => res.component,
      loadingComponent: res.loading,
      errorComponent: res.error,
      delay: res.delay,
      timeout: res.timeout,
    })
  } else if (res == null) {
    converted = defineAsyncComponent(() => fallbackPromise)
  } else {
    converted = comp as any // probably a v3 functional comp
  }
  normalizedAsyncComponentMap.set(comp, converted)
  return converted
}


/**
 * Use this for features with the same syntax but with mutually exclusive
 * behavior in 2 vs 3. Only warn if compat is enabled.
 * e.g. render function
 */
export function checkCompatEnabled(
  key: DeprecationTypes,
  instance: ComponentInternalInstance | null,
  ...args: any[]
): boolean {
  const enabled = isCompatEnabled(key, instance)
  if (__DEV__ && enabled) {
    warnDeprecation(key, instance, ...args)
  }
  return enabled
}

// run tests in v3 mode by default
if (__TEST__) {
  configureCompat({
    MODE: 3,
  })
}


export function configureCompat(config: CompatConfig): void {
  if (__DEV__) {
    validateCompatConfig(config)
  }
  extend(globalCompatConfig, config)
}


// dev only
export function validateCompatConfig(
  config: CompatConfig,
  instance?: ComponentInternalInstance,
): void {
  if (seenConfigObjects.has(config)) {
    return
  }
  seenConfigObjects.add(config)

  for (const key of Object.keys(config)) {
    if (
      key !== 'MODE' &&
      !(key in deprecationData) &&
      !(key in warnedInvalidKeys)
    ) {
      if (key.startsWith('COMPILER_')) {
        if (isRuntimeOnly()) {
          warn(
            `Deprecation config "${key}" is compiler-specific and you are ` +
            `running a runtime-only build of Vue. This deprecation should be ` +
            `configured via compiler options in your build setup instead.\n` +
            `Details: https://v3-migration.vuejs.org/breaking-changes/migration-build.html`,
          )
        }
      } else {
        warn(`Invalid deprecation config "${key}".`)
      }
      warnedInvalidKeys[key] = true
    }
  }

  if (instance && config[DeprecationTypes.OPTIONS_DATA_MERGE] != null) {
    warn(
      `Deprecation config "${DeprecationTypes.OPTIONS_DATA_MERGE}" can only be configured globally.`,
    )
  }
}


function createInnerComp(
  comp: ConcreteComponent,
  parent: ComponentInternalInstance,
) {
  const { ref, props, children, ce } = parent.vnode

  const vnode = createVNode(comp, props, children)
  // ensure inner component inherits the async wrapper's ref owner
  vnode.ref = ref
  // pass the custom element callback on to the inner comp
  // and remove it from the async wrapper
  vnode.ce = ce
  delete parent.vnode.ce

  return vnode
}

/**
 * There are 3 types of async boundaries:
 * - async components
 * - components with async setup()
 * - components with serverPrefetch
 */
export function markAsyncBoundary(instance: ComponentInternalInstance): void {
  instance.ids = [instance.ids[0] + instance.ids[2]++ + '-', 0, 0]
}


export function shouldSkipAttr(
  key: string,
  instance: ComponentInternalInstance,
): boolean {
  if (key === 'is') {
    return true
  }
  if (
    (key === 'class' || key === 'style') &&
    isCompatEnabled(DeprecationTypes.INSTANCE_ATTRS_CLASS_STYLE, instance)
  ) {
    return true
  }
  if (
    isOn(key) &&
    isCompatEnabled(DeprecationTypes.INSTANCE_LISTENERS, instance)
  ) {
    return true
  }
  // vue-router
  if (key.startsWith('routerView') || key === 'registerRouteInstance') {
    return true
  }
  return false
}


export function getCompatListeners(
  instance: ComponentInternalInstance,
): Record<string, Function | Function[]> {
  assertCompatEnabled(DeprecationTypes.INSTANCE_LISTENERS, instance)

  const listeners: Record<string, Function | Function[]> = {}
  const rawProps = instance.vnode.props
  if (!rawProps) {
    return listeners
  }
  for (const key in rawProps) {
    if (isOn(key)) {
      listeners[key[2].toLowerCase() + key.slice(3)] = rawProps[key]
    }
  }
  return listeners
}


/**
 * Use this for features that are completely removed in non-compat build.
 */
export function assertCompatEnabled(
  key: DeprecationTypes,
  instance: ComponentInternalInstance | null,
  ...args: any[]
): void {
  if (!isCompatEnabled(key, instance)) {
    throw new Error(`${key} compat has been disabled.`)
  } else if (__DEV__) {
    warnDeprecation(key, instance, ...args)
  }
}

const isBuiltInTag = /*@__PURE__*/ makeMap('slot,component')

export function validateComponentName(
  name: string,
  { isNativeTag }: AppConfig,
): void {
  if (isBuiltInTag(name) || isNativeTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component id: ' + name,
    )
  }
}

export const unsetCurrentInstance = (): void => {
  currentInstance && currentInstance.scope.off()
  internalSetCurrentInstance(null)
}


function setupStatefulComponent(
  instance: ComponentInternalInstance,
  isSSR: boolean,
) {
  const Component = instance.type as ComponentOptions

  if (__DEV__) {
    if (Component.name) {
      validateComponentName(Component.name, instance.appContext.config)
    }
    if (Component.components) {
      const names = Object.keys(Component.components)
      for (let i = 0; i < names.length; i++) {
        validateComponentName(names[i], instance.appContext.config)
      }
    }
    if (Component.directives) {
      const names = Object.keys(Component.directives)
      for (let i = 0; i < names.length; i++) {
        validateDirectiveName(names[i])
      }
    }
    if (Component.compilerOptions && isRuntimeOnly()) {
      warn(
        `"compilerOptions" is only supported when using a build of Vue that ` +
        `includes the runtime compiler. Since you are using a runtime-only ` +
        `build, the options should be passed via your build tool config instead.`,
      )
    }
  }
  // 0. create render proxy property access cache
  instance.accessCache = Object.create(null)
  // 1. create public instance / render proxy
  instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers)
  if (__DEV__) {
    exposePropsOnRenderContext(instance)
  }
  // 2. call setup()
  const { setup } = Component
  if (setup) {
    pauseTracking()
    const setupContext = (instance.setupContext =
      setup.length > 1 ? createSetupContext(instance) : null)
    const reset = setCurrentInstance(instance)
    const setupResult = callWithErrorHandling(
      setup,
      instance,
      ErrorCodes.SETUP_FUNCTION,
      [
        __DEV__ ? shallowReadonly(instance.props) : instance.props,
        setupContext,
      ],
    )
    const isAsyncSetup = isPromise(setupResult)
    resetTracking()
    reset()

    if ((isAsyncSetup || instance.sp) && !isAsyncWrapper(instance)) {
      // async setup / serverPrefetch, mark as async boundary for useId()
      markAsyncBoundary(instance)
    }

    if (isAsyncSetup) {
      setupResult.then(unsetCurrentInstance, unsetCurrentInstance)
      if (isSSR) {
        // return the promise so server-renderer can wait on it
        return setupResult
          .then((resolvedResult: unknown) => {
            handleSetupResult(instance, resolvedResult, isSSR)
          })
          .catch(e => {
            handleError(e, instance, ErrorCodes.SETUP_FUNCTION)
          })
      } else if (__FEATURE_SUSPENSE__) {
        // async setup returned Promise.
        // bail here and wait for re-entry.
        instance.asyncDep = setupResult
        if (__DEV__ && !instance.suspense) {
          const name = Component.name ?? 'Anonymous'
          warn(
            `Component <${name}>: setup function returned a promise, but no ` +
            `<Suspense> boundary was found in the parent component tree. ` +
            `A component with async setup() must be nested in a <Suspense> ` +
            `in order to be rendered.`,
          )
        }
      } else if (__DEV__) {
        warn(
          `setup() returned a Promise, but the version of Vue you are using ` +
          `does not support it yet.`,
        )
      }
    } else {
      handleSetupResult(instance, setupResult, isSSR)
    }
  } else {
    finishComponentSetup(instance, isSSR)
  }
}

export function finishComponentSetup(
  instance: ComponentInternalInstance,
  isSSR: boolean,
  skipOptions?: boolean,
): void {
  const Component = instance.type as ComponentOptions

  if (__COMPAT__) {
    convertLegacyRenderFn(instance)

    if (__DEV__ && Component.compatConfig) {
      validateCompatConfig(Component.compatConfig)
    }
  }

  // template / render function normalization
  // could be already set when returned from setup()
  if (!instance.render) {
    // only do on-the-fly compile if not in SSR - SSR on-the-fly compilation
    // is done by server-renderer
    if (!isSSR && compile && !Component.render) {
      const template =
        (__COMPAT__ &&
          instance.vnode.props &&
          instance.vnode.props['inline-template']) ||
        Component.template ||
        (__FEATURE_OPTIONS_API__ && resolveMergedOptions(instance).template)
      if (template) {
        if (__DEV__) {
          startMeasure(instance, `compile`)
        }
        const { isCustomElement, compilerOptions } = instance.appContext.config
        const { delimiters, compilerOptions: componentCompilerOptions } =
          Component
        const finalCompilerOptions: CompilerOptions = extend(
          extend(
            {
              isCustomElement,
              delimiters,
            },
            compilerOptions,
          ),
          componentCompilerOptions,
        )
        if (__COMPAT__) {
          // pass runtime compat config into the compiler
          finalCompilerOptions.compatConfig = Object.create(globalCompatConfig)
          if (Component.compatConfig) {
            // @ts-expect-error types are not compatible
            extend(finalCompilerOptions.compatConfig, Component.compatConfig)
          }
        }
        Component.render = compile(template, finalCompilerOptions)
        if (__DEV__) {
          endMeasure(instance, `compile`)
        }
      }
    }

    instance.render = (Component.render || NOOP) as InternalRenderFunction

    // for runtime-compiled render functions using `with` blocks, the render
    // proxy used needs a different `has` handler which is more performant and
    // also only allows a whitelist of globals to fallthrough.
    if (installWithProxy) {
      installWithProxy(instance)
    }
  }

  // support for 2.x options
  if (__FEATURE_OPTIONS_API__ && !(__COMPAT__ && skipOptions)) {
    const reset = setCurrentInstance(instance)
    pauseTracking()
    try {
      applyOptions(instance)
    } finally {
      resetTracking()
      reset()
    }
  }

  // warn missing template/render
  // the runtime compilation of template in SSR is done by server-render
  if (__DEV__ && !Component.render && instance.render === NOOP && !isSSR) {
    if (!compile && Component.template) {
      /* v8 ignore start */
      warn(
        `Component provided template option but ` +
        `runtime compilation is not supported in this build of Vue.` +
        (__ESM_BUNDLER__
          ? ` Configure your bundler to alias "vue" to "vue/dist/vue.esm-bundler.js".`
          : __ESM_BROWSER__
            ? ` Use "vue.esm-browser.js" instead.`
            : __GLOBAL__
              ? ` Use "vue.global.js" instead.`
              : ``) /* should not happen */,
      )
      /* v8 ignore stop */
    } else {
      warn(`Component is missing template or render function: `, Component)
    }
  }
}

const createHook =
  <T extends Function = () => any>(lifecycle: LifecycleHooks) =>
    (
      hook: T,
      target: ComponentInternalInstance | null = currentInstance,
    ): void => {
      // post-create lifecycle registrations are noops during SSR (except for serverPrefetch)
      if (
        !isInSSRComponentSetup ||
        lifecycle === LifecycleHooks.SERVER_PREFETCH
      ) {
        injectHook(lifecycle, (...args: unknown[]) => hook(...args), target)
      }
    }

export function injectHook(
  type: LifecycleHooks,
  hook: Function & { __weh?: Function },
  target: ComponentInternalInstance | null = currentInstance,
  prepend: boolean = false,
): Function | undefined {
  if (target) {
    const hooks = target[type] || (target[type] = [])
    // cache the error handling wrapper for injected hooks so the same hook
    // can be properly deduped by the scheduler. "__weh" stands for "with error
    // handling".
    const wrappedHook =
      hook.__weh ||
      (hook.__weh = (...args: unknown[]) => {
        // disable tracking inside all lifecycle hooks
        // since they can potentially be called inside effects.
        pauseTracking()
        // Set currentInstance during hook invocation.
        // This assumes the hook does not synchronously trigger other hooks, which
        // can only be false when the user does something really funky.
        const reset = setCurrentInstance(target)
        const res = callWithAsyncErrorHandling(hook, target, type, args)
        reset()
        resetTracking()
        return res
      })
    if (prepend) {
      hooks.unshift(wrappedHook)
    } else {
      hooks.push(wrappedHook)
    }
    return wrappedHook
  } else if (__DEV__) {
    const apiName = toHandlerKey(ErrorTypeStrings[type].replace(/ hook$/, ''))
    warn(
      `${apiName} is called when there is no active component instance to be ` +
      `associated with. ` +
      `Lifecycle injection APIs can only be used during execution of setup().` +
      (__FEATURE_SUSPENSE__
        ? ` If you are using async setup(), make sure to register lifecycle ` +
        `hooks before the first await statement.`
        : ``),
    )
  }
}

export const onBeforeMount: CreateHook = createHook(LifecycleHooks.BEFORE_MOUNT)
export const onMounted: CreateHook = createHook(LifecycleHooks.MOUNTED)
export const onBeforeUpdate: CreateHook = createHook(
  LifecycleHooks.BEFORE_UPDATE,
)
export const onUpdated: CreateHook = createHook(LifecycleHooks.UPDATED)
export function onActivated(
  hook: Function,
  target?: ComponentInternalInstance | null,
): void {
  registerKeepAliveHook(hook, LifecycleHooks.ACTIVATED, target)
}
export function onDeactivated(
  hook: Function,
  target?: ComponentInternalInstance | null,
): void {
  registerKeepAliveHook(hook, LifecycleHooks.DEACTIVATED, target)
}
export function onErrorCaptured<TError = Error>(
  hook: ErrorCapturedHook<TError>,
  target: ComponentInternalInstance | null = currentInstance,
): void {
  injectHook(LifecycleHooks.ERROR_CAPTURED, hook, target)
}
export const onRenderTracked: CreateHook<DebuggerHook> =
  createHook<DebuggerHook>(LifecycleHooks.RENDER_TRACKED)
export const onRenderTriggered: CreateHook<DebuggerHook> =
  createHook<DebuggerHook>(LifecycleHooks.RENDER_TRIGGERED)
export const onBeforeUnmount: CreateHook = createHook(
  LifecycleHooks.BEFORE_UNMOUNT,
)
export const onUnmounted: CreateHook = createHook(LifecycleHooks.UNMOUNTED)
export const onServerPrefetch: CreateHook = createHook(
  LifecycleHooks.SERVER_PREFETCH,
)

export function applyOptions(instance: ComponentInternalInstance): void {
  const options = resolveMergedOptions(instance)
  const publicThis = instance.proxy! as any
  const ctx = instance.ctx

  // do not cache property access on public proxy during state initialization
  shouldCacheAccess = false

  // call beforeCreate first before accessing other options since
  // the hook may mutate resolved options (#2791)
  if (options.beforeCreate) {
    callHook(options.beforeCreate, instance, LifecycleHooks.BEFORE_CREATE)
  }

  const {
    // state
    data: dataOptions,
    computed: computedOptions,
    methods,
    watch: watchOptions,
    provide: provideOptions,
    inject: injectOptions,
    // lifecycle
    created,
    beforeMount,
    mounted,
    beforeUpdate,
    updated,
    activated,
    deactivated,
    beforeDestroy,
    beforeUnmount,
    destroyed,
    unmounted,
    render,
    renderTracked,
    renderTriggered,
    errorCaptured,
    serverPrefetch,
    // public API
    expose,
    inheritAttrs,
    // assets
    components,
    directives,
    filters,
  } = options

  const checkDuplicateProperties = __DEV__ ? createDuplicateChecker() : null

  if (__DEV__) {
    const [propsOptions] = instance.propsOptions
    if (propsOptions) {
      for (const key in propsOptions) {
        checkDuplicateProperties!(OptionTypes.PROPS, key)
      }
    }
  }

  // options initialization order (to be consistent with Vue 2):
  // - props (already done outside of this function)
  // - inject
  // - methods
  // - data (deferred since it relies on `this` access)
  // - computed
  // - watch (deferred since it relies on `this` access)

  if (injectOptions) {
    resolveInjections(injectOptions, ctx, checkDuplicateProperties)
  }

  if (methods) {
    for (const key in methods) {
      const methodHandler = (methods as MethodOptions)[key]
      if (isFunction(methodHandler)) {
        // In dev mode, we use the `createRenderContext` function to define
        // methods to the proxy target, and those are read-only but
        // reconfigurable, so it needs to be redefined here
        if (__DEV__) {
          Object.defineProperty(ctx, key, {
            value: methodHandler.bind(publicThis),
            configurable: true,
            enumerable: true,
            writable: true,
          })
        } else {
          ctx[key] = methodHandler.bind(publicThis)
        }
        if (__DEV__) {
          checkDuplicateProperties!(OptionTypes.METHODS, key)
        }
      } else if (__DEV__) {
        warn(
          `Method "${key}" has type "${typeof methodHandler}" in the component definition. ` +
          `Did you reference the function correctly?`,
        )
      }
    }
  }

  if (dataOptions) {
    if (__DEV__ && !isFunction(dataOptions)) {
      warn(
        `The data option must be a function. ` +
        `Plain object usage is no longer supported.`,
      )
    }
    const data = dataOptions.call(publicThis, publicThis)
    if (__DEV__ && isPromise(data)) {
      warn(
        `data() returned a Promise - note data() cannot be async; If you ` +
        `intend to perform data fetching before component renders, use ` +
        `async setup() + <Suspense>.`,
      )
    }
    if (!isObject(data)) {
      __DEV__ && warn(`data() should return an object.`)
    } else {
      instance.data = reactive(data)
      if (__DEV__) {
        for (const key in data) {
          checkDuplicateProperties!(OptionTypes.DATA, key)
          // expose data on ctx during dev
          if (!isReservedPrefix(key[0])) {
            Object.defineProperty(ctx, key, {
              configurable: true,
              enumerable: true,
              get: () => data[key],
              set: NOOP,
            })
          }
        }
      }
    }
  }

  // state initialization complete at this point - start caching access
  shouldCacheAccess = true

  if (computedOptions) {
    for (const key in computedOptions) {
      const opt = (computedOptions as ComputedOptions)[key]
      const get = isFunction(opt)
        ? opt.bind(publicThis, publicThis)
        : isFunction(opt.get)
          ? opt.get.bind(publicThis, publicThis)
          : NOOP
      if (__DEV__ && get === NOOP) {
        warn(`Computed property "${key}" has no getter.`)
      }
      const set =
        !isFunction(opt) && isFunction(opt.set)
          ? opt.set.bind(publicThis)
          : __DEV__
            ? () => {
              warn(
                `Write operation failed: computed property "${key}" is readonly.`,
              )
            }
            : NOOP
      const c = computed({
        get,
        set,
      })
      Object.defineProperty(ctx, key, {
        enumerable: true,
        configurable: true,
        get: () => c.value,
        set: v => (c.value = v),
      })
      if (__DEV__) {
        checkDuplicateProperties!(OptionTypes.COMPUTED, key)
      }
    }
  }

  if (watchOptions) {
    for (const key in watchOptions) {
      createWatcher(watchOptions[key], ctx, publicThis, key)
    }
  }

  if (provideOptions) {
    const provides = isFunction(provideOptions)
      ? provideOptions.call(publicThis)
      : provideOptions
    Reflect.ownKeys(provides).forEach(key => {
      provide(key, provides[key])
    })
  }

  if (created) {
    callHook(created, instance, LifecycleHooks.CREATED)
  }

  function registerLifecycleHook(
    register: Function,
    hook?: Function | Function[],
  ) {
    if (isArray(hook)) {
      hook.forEach(_hook => register(_hook.bind(publicThis)))
    } else if (hook) {
      register(hook.bind(publicThis))
    }
  }

  registerLifecycleHook(onBeforeMount, beforeMount)
  registerLifecycleHook(onMounted, mounted)
  registerLifecycleHook(onBeforeUpdate, beforeUpdate)
  registerLifecycleHook(onUpdated, updated)
  registerLifecycleHook(onActivated, activated)
  registerLifecycleHook(onDeactivated, deactivated)
  registerLifecycleHook(onErrorCaptured, errorCaptured)
  registerLifecycleHook(onRenderTracked, renderTracked)
  registerLifecycleHook(onRenderTriggered, renderTriggered)
  registerLifecycleHook(onBeforeUnmount, beforeUnmount)
  registerLifecycleHook(onUnmounted, unmounted)
  registerLifecycleHook(onServerPrefetch, serverPrefetch)

  if (__COMPAT__) {
    if (
      beforeDestroy &&
      softAssertCompatEnabled(DeprecationTypes.OPTIONS_BEFORE_DESTROY, instance)
    ) {
      registerLifecycleHook(onBeforeUnmount, beforeDestroy)
    }
    if (
      destroyed &&
      softAssertCompatEnabled(DeprecationTypes.OPTIONS_DESTROYED, instance)
    ) {
      registerLifecycleHook(onUnmounted, destroyed)
    }
  }

  if (isArray(expose)) {
    if (expose.length) {
      const exposed = instance.exposed || (instance.exposed = {})
      expose.forEach(key => {
        Object.defineProperty(exposed, key, {
          get: () => publicThis[key],
          set: val => (publicThis[key] = val),
          enumerable: true,
        })
      })
    } else if (!instance.exposed) {
      instance.exposed = {}
    }
  }

  // options that are handled when creating the instance but also need to be
  // applied from mixins
  if (render && instance.render === NOOP) {
    instance.render = render as InternalRenderFunction
  }
  if (inheritAttrs != null) {
    instance.inheritAttrs = inheritAttrs
  }

  // asset options.
  if (components) instance.components = components as any
  if (directives) instance.directives = directives
  if (
    __COMPAT__ &&
    filters &&
    isCompatEnabled(DeprecationTypes.FILTERS, instance)
  ) {
    instance.filters = filters
  }

  if (__SSR__ && serverPrefetch) {
    markAsyncBoundary(instance)
  }
}


export function createWatcher(
  raw: ComponentWatchOptionItem,
  ctx: Data,
  publicThis: ComponentPublicInstance,
  key: string,
): void {
  let getter = key.includes('.')
    ? createPathGetter(publicThis, key)
    : () => (publicThis as any)[key]

  const options: WatchOptions = {}
  if (__COMPAT__) {
    const instance =
      currentInstance && getCurrentScope() === currentInstance.scope
        ? currentInstance
        : null

    const newValue = getter()
    if (
      isArray(newValue) &&
      isCompatEnabled(DeprecationTypes.WATCH_ARRAY, instance)
    ) {
      options.deep = true
    }

    const baseGetter = getter
    getter = () => {
      const val = baseGetter()
      if (
        isArray(val) &&
        checkCompatEnabled(DeprecationTypes.WATCH_ARRAY, instance)
      ) {
        traverse(val)
      }
      return val
    }
  }

  if (isString(raw)) {
    const handler = ctx[raw]
    if (isFunction(handler)) {
      if (__COMPAT__) {
        watchAPI(getter, handler as WatchCallback, options)
      } else {
        watchAPI(getter, handler as WatchCallback)
      }
    } else if (__DEV__) {
      warn(`Invalid watch handler specified by key "${raw}"`, handler)
    }
  } else if (isFunction(raw)) {
    if (__COMPAT__) {
      watchAPI(getter, raw.bind(publicThis), options)
    } else {
      watchAPI(getter, raw.bind(publicThis))
    }
  } else if (isObject(raw)) {
    if (isArray(raw)) {
      raw.forEach(r => createWatcher(r, ctx, publicThis, key))
    } else {
      const handler = isFunction(raw.handler)
        ? raw.handler.bind(publicThis)
        : (ctx[raw.handler] as WatchCallback)
      if (isFunction(handler)) {
        watchAPI(getter, handler, __COMPAT__ ? extend(raw, options) : raw)
      } else if (__DEV__) {
        warn(`Invalid watch handler specified by key "${raw.handler}"`, handler)
      }
    }
  } else if (__DEV__) {
    warn(`Invalid watch option: "${key}"`, raw)
  }
}

function hasPropsChanged(
  prevProps: Data,
  nextProps: Data,
  emitsOptions: ComponentInternalInstance['emitsOptions'],
): boolean {
  const nextKeys = Object.keys(nextProps)
  if (nextKeys.length !== Object.keys(prevProps).length) {
    return true
  }
  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i]
    if (
      nextProps[key] !== prevProps[key] &&
      !isEmitListener(emitsOptions, key)
    ) {
      return true
    }
  }
  return false
}
function installFilterMethod(app: App, context: AppContext) {
  context.filters = {}
  app.filter = (name: string, filter?: Function): any => {
    assertCompatEnabled(DeprecationTypes.FILTERS, null)
    if (!filter) {
      return context.filters![name]
    }
    if (__DEV__ && context.filters![name]) {
      warn(`Filter "${name}" has already been registered.`)
    }
    context.filters![name] = filter
    return app
  }
}

export function installLegacyOptionMergeStrats(config: AppConfig): void {
  config.optionMergeStrategies = new Proxy({} as any, {
    get(target, key) {
      if (key in target) {
        return target[key]
      }
      if (
        key in internalOptionMergeStrats &&
        softAssertCompatEnabled(
          DeprecationTypes.CONFIG_OPTION_MERGE_STRATS,
          null,
        )
      ) {
        return internalOptionMergeStrats[
          key as keyof typeof internalOptionMergeStrats
        ]
      }
    },
  })
}

function installCompatMount(
  app: App,
  context: AppContext,
  render: RootRenderFunction,
) {
  let isMounted = false

  /**
   * Vue 2 supports the behavior of creating a component instance but not
   * mounting it, which is no longer possible in Vue 3 - this internal
   * function simulates that behavior.
   */
  app._createRoot = options => {
    const component = app._component

    const vnode = createVNode(component, options.propsData || null)
    vnode.appContext = context

    const hasNoRender =
      !isFunction(component) && !component.render && !component.template
    const emptyRender = () => { }

    // create root instance
    const instance = createComponentInstance(vnode, null, null)
    // suppress "missing render fn" warning since it can't be determined
    // until $mount is called
    if (hasNoRender) {
      instance.render = emptyRender
    }
    setupComponent(instance)
    vnode.component = instance
    vnode.isCompatRoot = true

    // $mount & $destroy
    // these are defined on ctx and picked up by the $mount/$destroy
    // public property getters on the instance proxy.
    // Note: the following assumes DOM environment since the compat build
    // only targets web. It essentially includes logic for app.mount from
    // both runtime-core AND runtime-dom.
    instance.ctx._compat_mount = (selectorOrEl?: string | Element) => {
      if (isMounted) {
        __DEV__ && warn(`Root instance is already mounted.`)
        return
      }

      let container: Element
      if (typeof selectorOrEl === 'string') {
        // eslint-disable-next-line
        const result = document.querySelector(selectorOrEl)
        if (!result) {
          __DEV__ &&
            warn(
              `Failed to mount root instance: selector "${selectorOrEl}" returned null.`,
            )
          return
        }
        container = result
      } else {
        // eslint-disable-next-line
        container = selectorOrEl || document.createElement('div')
      }

      let namespace: ElementNamespace
      if (container instanceof SVGElement) namespace = 'svg'
      else if (
        typeof MathMLElement === 'function' &&
        container instanceof MathMLElement
      )
        namespace = 'mathml'

      // HMR root reload
      if (__DEV__) {
        context.reload = () => {
          const cloned = cloneVNode(vnode)
          // compat mode will use instance if not reset to null
          cloned.component = null
          render(cloned, container, namespace)
        }
      }

      // resolve in-DOM template if component did not provide render
      // and no setup/mixin render functions are provided (by checking
      // that the instance is still using the placeholder render fn)
      if (hasNoRender && instance.render === emptyRender) {
        // root directives check
        if (__DEV__) {
          for (let i = 0; i < container.attributes.length; i++) {
            const attr = container.attributes[i]
            if (attr.name !== 'v-cloak' && /^(v-|:|@)/.test(attr.name)) {
              warnDeprecation(DeprecationTypes.GLOBAL_MOUNT_CONTAINER, null)
              break
            }
          }
        }
        instance.render = null
          ; (component as ComponentOptions).template = container.innerHTML
        finishComponentSetup(instance, false, true /* skip options */)
      }

      // clear content before mounting
      container.textContent = ''

      // TODO hydration
      render(vnode, container, namespace)

      if (container instanceof Element) {
        container.removeAttribute('v-cloak')
        container.setAttribute('data-v-app', '')
      }

      isMounted = true
      app._container = container
        // for devtools and telemetry
        ; (container as any).__vue_app__ = app
      if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        devtoolsInitApp(app, version)
      }

      return instance.proxy!
    }

    instance.ctx._compat_destroy = () => {
      if (isMounted) {
        render(null, app._container)
        if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
          devtoolsUnmountApp(app)
        }
        delete app._container.__vue_app__
      } else {
        const { bum, scope, um } = instance
        // beforeDestroy hooks
        if (bum) {
          invokeArrayFns(bum)
        }
        if (isCompatEnabled(DeprecationTypes.INSTANCE_EVENT_HOOKS, instance)) {
          instance.emit('hook:beforeDestroy')
        }
        // stop effects
        if (scope) {
          scope.stop()
        }
        // unmounted hook
        if (um) {
          invokeArrayFns(um)
        }
        if (isCompatEnabled(DeprecationTypes.INSTANCE_EVENT_HOOKS, instance)) {
          instance.emit('hook:destroyed')
        }
      }
    }

    return instance.proxy!
  }
}

function installLegacyAPIs(app: App) {
  // expose global API on app instance for legacy plugins
  Object.defineProperties(app, {
    // so that app.use() can work with legacy plugins that extend prototypes
    prototype: {
      get() {
        __DEV__ && warnDeprecation(DeprecationTypes.GLOBAL_PROTOTYPE, null)
        return app.config.globalProperties
      },
    },
    nextTick: { value: nextTick },
    extend: { value: singletonCtor.extend },
    set: { value: singletonCtor.set },
    delete: { value: singletonCtor.delete },
    observable: { value: singletonCtor.observable },
    util: {
      get() {
        return singletonCtor.util
      },
    },
  })
}

function applySingletonAppMutations(app: App) {
  // copy over asset registries and deopt flag
  app._context.mixins = [...singletonApp._context.mixins]
    ;['components', 'directives', 'filters'].forEach(key => {
      // @ts-expect-error
      app._context[key] = Object.create(singletonApp._context[key])
    })

  // copy over global config mutations
  isCopyingConfig = true
  for (const key in singletonApp.config) {
    if (key === 'isNativeTag') continue
    if (
      isRuntimeOnly() &&
      (key === 'isCustomElement' || key === 'compilerOptions')
    ) {
      continue
    }
    const val = singletonApp.config[key as keyof AppConfig]
    // @ts-expect-error
    app.config[key] = isObject(val) ? Object.create(val) : val

    // compat for runtime ignoredElements -> isCustomElement
    if (
      key === 'ignoredElements' &&
      isCompatEnabled(DeprecationTypes.CONFIG_IGNORED_ELEMENTS, null) &&
      !isRuntimeOnly() &&
      isArray(val)
    ) {
      app.config.compilerOptions.isCustomElement = tag => {
        return val.some(v => (isString(v) ? v === tag : v.test(tag)))
      }
    }
  }
  isCopyingConfig = false
  applySingletonPrototype(app, singletonCtor)
}

// dev only
export function installLegacyConfigWarnings(config: AppConfig): void {
  const legacyConfigOptions: Record<string, DeprecationTypes> = {
    silent: DeprecationTypes.CONFIG_SILENT,
    devtools: DeprecationTypes.CONFIG_DEVTOOLS,
    ignoredElements: DeprecationTypes.CONFIG_IGNORED_ELEMENTS,
    keyCodes: DeprecationTypes.CONFIG_KEY_CODES,
    productionTip: DeprecationTypes.CONFIG_PRODUCTION_TIP,
  }

  Object.keys(legacyConfigOptions).forEach(key => {
    let val = (config as any)[key]
    Object.defineProperty(config, key, {
      enumerable: true,
      get() {
        return val
      },
      set(newVal) {
        if (!isCopyingConfig) {
          warnDeprecation(legacyConfigOptions[key], null)
        }
        val = newVal
      },
    })
  })
}

export function installAppCompatProperties(
  app: App,
  context: AppContext,
  render: RootRenderFunction<any>,
): void {
  installFilterMethod(app, context)
  installLegacyOptionMergeStrats(app.config)

  if (!singletonApp) {
    // this is the call of creating the singleton itself so the rest is
    // unnecessary
    return
  }

  installCompatMount(app, context, render)
  installLegacyAPIs(app)
  applySingletonAppMutations(app)
  if (__DEV__) installLegacyConfigWarnings(app.config)
}

function applySingletonPrototype(app: App, Ctor: Function) {
  // copy prototype augmentations as config.globalProperties
  const enabled = isCompatEnabled(DeprecationTypes.GLOBAL_PROTOTYPE, null)
  if (enabled) {
    app.config.globalProperties = Object.create(Ctor.prototype)
  }
  let hasPrototypeAugmentations = false
  for (const key of Object.getOwnPropertyNames(Ctor.prototype)) {
    if (key !== 'constructor') {
      hasPrototypeAugmentations = true
      if (enabled) {
        Object.defineProperty(
          app.config.globalProperties,
          key,
          Object.getOwnPropertyDescriptor(Ctor.prototype, key)!,
        )
      }
    }
  }
  if (__DEV__ && hasPrototypeAugmentations) {
    warnDeprecation(DeprecationTypes.GLOBAL_PROTOTYPE, null)
  }
}

//
export function nextTick<T = void, R = void>(
  this: T,
  fn?: (this: T) => R,
): Promise<Awaited<R>> {
  const p = currentFlushPromise || resolvedPromise
  return fn ? p.then(this ? fn.bind(this) : fn) : p
}

export function deepMergeData(to: any, from: any): any {
  for (const key in from) {
    const toVal = to[key]
    const fromVal = from[key]
    if (key in to && isPlainObject(toVal) && isPlainObject(fromVal)) {
      __DEV__ && warnDeprecation(DeprecationTypes.OPTIONS_DATA_MERGE, null, key)
      deepMergeData(toVal, fromVal)
    } else {
      to[key] = fromVal
    }
  }
  return to
}


function isVNodeSuspensible(vnode: VNode) {
  const suspensible = vnode.props && vnode.props.suspensible
  return suspensible != null && suspensible !== false
}

export function handleSetupResult(
  instance: ComponentInternalInstance,
  setupResult: unknown,
  isSSR: boolean,
): void {
  if (isFunction(setupResult)) {
    // setup returned an inline render function
    if (__SSR__ && (instance.type as ComponentOptions).__ssrInlineRender) {
      // when the function's name is `ssrRender` (compiled by SFC inline mode),
      // set it as ssrRender instead.
      instance.ssrRender = setupResult
    } else {
      instance.render = setupResult as InternalRenderFunction
    }
  } else if (isObject(setupResult)) {
    if (__DEV__ && isVNode(setupResult)) {
      warn(
        `setup() should not return VNodes directly - ` +
        `return a render function instead.`,
      )
    }
    // setup returned bindings.
    // assuming a render function compiled from template is present.
    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      instance.devtoolsRawSetupState = setupResult
    }
    instance.setupState = proxyRefs(setupResult)
    if (__DEV__) {
      exposeSetupStateOnRenderContext(instance)
    }
  } else if (__DEV__ && setupResult !== undefined) {
    warn(
      `setup() should return an object. Received: ${setupResult === null ? 'null' : typeof setupResult
      }`,
    )
  }
  finishComponentSetup(instance, isSSR)
}

// dev only
export function exposeSetupStateOnRenderContext(
  instance: ComponentInternalInstance,
): void {
  const { ctx, setupState } = instance
  Object.keys(toRaw(setupState)).forEach(key => {
    if (!setupState.__isScriptSetup) {
      if (isReservedPrefix(key[0])) {
        warn(
          `setup() return property ${JSON.stringify(
            key,
          )} should not start with "$" or "_" ` +
          `which are reserved prefixes for Vue internals.`,
        )
        return
      }
      Object.defineProperty(ctx, key, {
        enumerable: true,
        configurable: true,
        get: () => setupState[key],
        set: NOOP,
      })
    }
  })
}


export function exposePropsOnRenderContext(
  instance: ComponentInternalInstance,
): void {
  const {
    ctx,
    propsOptions: [propsOptions],
  } = instance
  if (propsOptions) {
    Object.keys(propsOptions).forEach(key => {
      Object.defineProperty(ctx, key, {
        enumerable: true,
        configurable: true,
        get: () => instance.props[key],
        set: NOOP,
      })
    })
  }
}

export function createSetupContext(
  instance: ComponentInternalInstance,
): SetupContext {
  const expose: SetupContext['expose'] = exposed => {
    if (__DEV__) {
      if (instance.exposed) {
        warn(`expose() should be called only once per setup().`)
      }
      if (exposed != null) {
        let exposedType: string = typeof exposed
        if (exposedType === 'object') {
          if (isArray(exposed)) {
            exposedType = 'array'
          } else if (isRef(exposed)) {
            exposedType = 'ref'
          }
        }
        if (exposedType !== 'object') {
          warn(
            `expose() should be passed a plain object, received ${exposedType}.`,
          )
        }
      }
    }
    instance.exposed = exposed || {}
  }

  if (__DEV__) {
    // We use getters in dev in case libs like test-utils overwrite instance
    // properties (overwrites should not be done in prod)
    let attrsProxy: Data
    let slotsProxy: Slots
    return Object.freeze({
      get attrs() {
        return (
          attrsProxy ||
          (attrsProxy = new Proxy(instance.attrs, attrsProxyHandlers))
        )
      },
      get slots() {
        return slotsProxy || (slotsProxy = getSlotsProxy(instance))
      },
      get emit() {
        return (event: string, ...args: any[]) => instance.emit(event, ...args)
      },
      expose,
    })
  } else {
    return {
      attrs: new Proxy(instance.attrs, attrsProxyHandlers),
      slots: instance.slots,
      emit: instance.emit,
      expose,
    }
  }
}


/**
 * Dev-only
 */
function getSlotsProxy(instance: ComponentInternalInstance): Slots {
  return new Proxy(instance.slots, {
    get(target, key: string) {
      track(instance, TrackOpTypes.GET, '$slots')
      return target[key]
    },
  })
}

function registerKeepAliveHook(
  hook: Function & { __wdc?: Function },
  type: LifecycleHooks,
  target: ComponentInternalInstance | null = currentInstance,
) {
  // cache the deactivate branch check wrapper for injected hooks so the same
  // hook can be properly deduped by the scheduler. "__wdc" stands for "with
  // deactivation check".
  const wrappedHook =
    hook.__wdc ||
    (hook.__wdc = () => {
      // only fire the hook if the target instance is NOT in a deactivated branch.
      let current: ComponentInternalInstance | null = target
      while (current) {
        if (current.isDeactivated) {
          return
        }
        current = current.parent
      }
      return hook()
    })
  injectHook(type, wrappedHook, target)
  // In addition to registering it on the target instance, we walk up the parent
  // chain and register it on all ancestor instances that are keep-alive roots.
  // This avoids the need to walk the entire component tree when invoking these
  // hooks, and more importantly, avoids the need to track child components in
  // arrays.
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

function callHook(
  hook: Function,
  instance: ComponentInternalInstance,
  type: LifecycleHooks,
) {
  callWithAsyncErrorHandling(
    isArray(hook)
      ? hook.map(h => h.bind(instance.proxy!))
      : hook.bind(instance.proxy!),
    instance,
    type,
  )
}

function createDuplicateChecker() {
  const cache = Object.create(null)
  return (type: OptionTypes, key: string) => {
    if (cache[key]) {
      warn(`${type} property "${key}" is already defined in ${cache[key]}.`)
    } else {
      cache[key] = type
    }
  }
}

export function resolveInjections(
  injectOptions: ComponentInjectOptions,
  ctx: any,
  checkDuplicateProperties = NOOP as any,
): void {
  if (isArray(injectOptions)) {
    injectOptions = normalizeInject(injectOptions)!
  }
  for (const key in injectOptions) {
    const opt = injectOptions[key]
    let injected: unknown
    if (isObject(opt)) {
      if ('default' in opt) {
        injected = inject(
          opt.from || key,
          opt.default,
          true /* treat default function as factory */,
        )
      } else {
        injected = inject(opt.from || key)
      }
    } else {
      injected = inject(opt)
    }
    if (isRef(injected)) {
      // unwrap injected refs (ref #4196)
      Object.defineProperty(ctx, key, {
        enumerable: true,
        configurable: true,
        get: () => (injected as Ref).value,
        set: v => ((injected as Ref).value = v),
      })
    } else {
      ctx[key] = injected
    }
    if (__DEV__) {
      checkDuplicateProperties!(OptionTypes.INJECT, key)
    }
  }
}


/**
 * @private
 */
export function createTextVNode(text: string = ' ', flag: number = 0): VNode {

  return createVNode(Text, null, text, flag)
}



// defineComponent is a utility that is primarily used for type inference
// when declaring components. Type inference is provided in the component
// options (provided as the argument). The returned value has artificial types
// for TSX / manual render function / IDE support.

// overload 1: direct setup function
// (uses user defined props interface)
export function defineComponent<
  Props extends Record<string, any>,
  E extends EmitsOptions = {},
  EE extends string = string,
  S extends SlotsType = {},
>(
  setup: (
    props: Props,
    ctx: SetupContext<E, S>,
  ) => RenderFunction | Promise<RenderFunction>,
  options?: Pick<ComponentOptions, 'name' | 'inheritAttrs'> & {
    props?: (keyof Props)[]
    emits?: E | EE[]
    slots?: S
  },
): DefineSetupFnComponent<Props, E, S>
export function defineComponent<
  Props extends Record<string, any>,
  E extends EmitsOptions = {},
  EE extends string = string,
  S extends SlotsType = {},
>(
  setup: (
    props: Props,
    ctx: SetupContext<E, S>,
  ) => RenderFunction | Promise<RenderFunction>,
  options?: Pick<ComponentOptions, 'name' | 'inheritAttrs'> & {
    props?: ComponentObjectPropsOptions<Props>
    emits?: E | EE[]
    slots?: S
  },
): DefineSetupFnComponent<Props, E, S>

// overload 2: defineComponent with options object, infer props from options
export function defineComponent<
  // props
  TypeProps,
  RuntimePropsOptions extends
  ComponentObjectPropsOptions = ComponentObjectPropsOptions,
  RuntimePropsKeys extends string = string,
  // emits
  TypeEmits extends ComponentTypeEmits = {},
  RuntimeEmitsOptions extends EmitsOptions = {},
  RuntimeEmitsKeys extends string = string,
  // other options
  Data = {},
  SetupBindings = {},
  Computed extends ComputedOptions = {},
  Methods extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  InjectOptions extends ComponentInjectOptions = {},
  InjectKeys extends string = string,
  Slots extends SlotsType = {},
  LocalComponents extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string,
  Provide extends ComponentProvideOptions = ComponentProvideOptions,
  // resolved types
  ResolvedEmits extends EmitsOptions = {} extends RuntimeEmitsOptions
  ? TypeEmitsToOptions<TypeEmits>
  : RuntimeEmitsOptions,
  InferredProps = IsKeyValues<TypeProps> extends true
  ? TypeProps
  : string extends RuntimePropsKeys
  ? ComponentObjectPropsOptions extends RuntimePropsOptions
  ? {}
  : ExtractPropTypes<RuntimePropsOptions>
  : { [key in RuntimePropsKeys]?: any },
  TypeRefs extends Record<string, unknown> = {},
  TypeEl extends Element = any,
>(
  options: {
    props?: (RuntimePropsOptions & ThisType<void>) | RuntimePropsKeys[]
    /**
     * @private for language-tools use only
     */
    __typeProps?: TypeProps
    /**
     * @private for language-tools use only
     */
    __typeEmits?: TypeEmits
    /**
     * @private for language-tools use only
     */
    __typeRefs?: TypeRefs
    /**
     * @private for language-tools use only
     */
    __typeEl?: TypeEl
  } & ComponentOptionsBase<
    ToResolvedProps<InferredProps, ResolvedEmits>,
    SetupBindings,
    Data,
    Computed,
    Methods,
    Mixin,
    Extends,
    RuntimeEmitsOptions,
    RuntimeEmitsKeys,
    {}, // Defaults
    InjectOptions,
    InjectKeys,
    Slots,
    LocalComponents,
    Directives,
    Exposed,
    Provide
  > &
    ThisType<
      CreateComponentPublicInstanceWithMixins<
        ToResolvedProps<InferredProps, ResolvedEmits>,
        SetupBindings,
        Data,
        Computed,
        Methods,
        Mixin,
        Extends,
        ResolvedEmits,
        {},
        {},
        false,
        InjectOptions,
        Slots,
        LocalComponents,
        Directives,
        Exposed
      >
    >,
): DefineComponent<
  InferredProps,
  SetupBindings,
  Data,
  Computed,
  Methods,
  Mixin,
  Extends,
  ResolvedEmits,
  RuntimeEmitsKeys,
  PublicProps,
  ToResolvedProps<InferredProps, ResolvedEmits>,
  ExtractDefaultPropTypes<RuntimePropsOptions>,
  Slots,
  LocalComponents,
  Directives,
  Exposed,
  Provide,
  // MakeDefaultsOptional - if TypeProps is provided, set to false to use
  // user props types verbatim
  unknown extends TypeProps ? true : false,
  TypeRefs,
  TypeEl
>

// implementation, close to no-op
/*! #__NO_SIDE_EFFECTS__ */
export function defineComponent(
  options: unknown,
  extraOptions?: ComponentOptions,
) {
  return isFunction(options)
    ? // #8236: extend call and options.name access are considered side-effects
      // by Rollup, so we have to wrap it in a pure-annotated IIFE.
      /*@__PURE__*/ (() =>
      extend({ name: options.name }, extraOptions, { setup: options }))()
    : options
}



function injectToKeepAliveRoot(
  hook: Function & { __weh?: Function },
  type: LifecycleHooks,
  target: ComponentInternalInstance,
  keepAliveRoot: ComponentInternalInstance,
) {
  // injectHook wraps the original for error handling, so make sure to remove
  // the wrapped version.
  const injected = injectHook(type, hook, keepAliveRoot, true /* prepend */)
  onUnmounted(() => {
    remove(keepAliveRoot[type]!, injected)
  }, target)
}


export function closeBlock(): void {
  blockStack.pop()
  currentBlock = blockStack[blockStack.length - 1] || null
}

export function openBlock(disableTracking = false): void {
  blockStack.push((currentBlock = disableTracking ? null : []))
}

export function compatH(
  type: string | Component,
  children?: LegacyVNodeChildren,
): VNode
export function compatH(
  type: string | Component,
  props?: Data & LegacyVNodeProps,
  children?: LegacyVNodeChildren,
): VNode

export function compatH(
  type: any,
  propsOrChildren?: any,
  children?: any,
): VNode {
  if (!type) {
    type = Comment
  }

  // to support v2 string component name look!up
  if (typeof type === 'string') {
    const t = hyphenate(type)
    if (t === 'transition' || t === 'transition-group' || t === 'keep-alive') {
      // since transition and transition-group are runtime-dom-specific,
      // we cannot import them directly here. Instead they are registered using
      // special keys in @vue/compat entry.
      type = `__compat__${t}`
    }
    type = resolveDynamicComponent(type)
  }

  const l = arguments.length
  const is2ndArgArrayChildren = isArray(propsOrChildren)
  if (l === 2 || is2ndArgArrayChildren) {
    if (isObject(propsOrChildren) && !is2ndArgArrayChildren) {
      // single vnode without props
      if (isVNode(propsOrChildren)) {

        return convertLegacySlots(createVNode(type, null, [propsOrChildren]))
      }

      // props without children
      return convertLegacySlots(
        convertLegacyDirectives(
          createVNode(type, convertLegacyProps(propsOrChildren, type)),
          propsOrChildren,
        ),
      )
    } else {

      // omit props
      return convertLegacySlots(createVNode(type, null, propsOrChildren))
    }
  } else {
    if (isVNode(children)) {
      children = [children]
    }

    return convertLegacySlots(
      convertLegacyDirectives(
        createVNode(type, convertLegacyProps(propsOrChildren, type), children),
        propsOrChildren,
      ),
    )
  }
}

const isSimpleType = /*@__PURE__*/ makeMap(
  'String,Number,Boolean,Function,Symbol,BigInt',
)

/**
 * dev only
 */
function assertType(
  value: unknown,
  type: PropConstructor | null,
): AssertionResult {
  let valid
  const expectedType = getType(type)
  if (expectedType === 'null') {
    valid = value === null
  } else if (isSimpleType(expectedType)) {
    const t = typeof value
    valid = t === expectedType.toLowerCase()
    // for primitive wrapper objects
    if (!valid && t === 'object') {
      valid = value instanceof (type as PropConstructor)
    }
  } else if (expectedType === 'Object') {
    valid = isObject(value)
  } else if (expectedType === 'Array') {
    valid = isArray(value)
  } else {
    valid = value instanceof (type as PropConstructor)
  }
  return {
    valid,
    expectedType,
  }
}


// dev only
// use function string name to check type constructors
// so that it works across vms / iframes.
function getType(ctor: Prop<any> | null): string {
  // Early return for null to avoid unnecessary computations
  if (ctor === null) {
    return 'null'
  }

  // Avoid using regex for common cases by checking the type directly
  if (typeof ctor === 'function') {
    // Using name property to avoid converting function to string
    return ctor.name || ''
  } else if (typeof ctor === 'object') {
    // Attempting to directly access constructor name if possible
    const name = ctor.constructor && ctor.constructor.name
    return name || ''
  }

  // Fallback for other types (though they're less likely to have meaningful names here)
  return ''
}

export function convertLegacyRenderFn(
  instance: ComponentInternalInstance,
): void {
  const Component = instance.type as ComponentOptions
  const render = Component.render as InternalRenderFunction | undefined

  // v3 runtime compiled, or already checked / wrapped
  if (!render || render._rc || render._compatChecked || render._compatWrapped) {
    return
  }

  if (render.length >= 2) {
    // v3 pre-compiled function, since v2 render functions never need more than
    // 2 arguments, and v2 functional render functions would have already been
    // normalized into v3 functional components
    render._compatChecked = true
    return
  }

  // v2 render function, try to provide compat
  if (checkCompatEnabled(DeprecationTypes.RENDER_FUNCTION, instance)) {
    const wrapped = (Component.render = function compatRender() {
      // @ts-expect-error
      return render.call(this, compatH)
    })
    // @ts-expect-error
    wrapped._compatWrapped = true
  }
}


/**
 * @private
 */
export function resolveDynamicComponent(component: unknown): VNodeTypes {
  if (isString(component)) {
    return resolveAsset(COMPONENTS, component, false) || component
  } else {
    // invalid types will fallthrough to createVNode and raise warning
    return (component || NULL_DYNAMIC_COMPONENT) as any
  }
}


/**
 * @private
 * overload 1: components
 */
function resolveAsset(
  type: typeof COMPONENTS,
  name: string,
  warnMissing?: boolean,
  maybeSelfReference?: boolean,
): ConcreteComponent | undefined
// overload 2: directives
function resolveAsset(
  type: typeof DIRECTIVES,
  name: string,
): Directive | undefined
// implementation
// overload 3: filters (compat only)
function resolveAsset(type: typeof FILTERS, name: string): Function | undefined
// implementation
function resolveAsset(
  type: AssetTypes,
  name: string,
  warnMissing = true,
  maybeSelfReference = false,
) {
  const instance = currentRenderingInstance || currentInstance
  if (instance) {
    const Component = instance.type

    // explicit self name has highest priority
    if (type === COMPONENTS) {
      const selfName = getComponentName(
        Component,
        false /* do not include inferred name to avoid breaking existing code */,
      )
      if (
        selfName &&
        (selfName === name ||
          selfName === camelize(name) ||
          selfName === capitalize(camelize(name)))
      ) {
        return Component
      }
    }

    const res =
      // local registration
      // check instance[type] first which is resolved for options API
      resolve(instance[type] || (Component as ComponentOptions)[type], name) ||
      // global registration
      resolve(instance.appContext[type], name)

    if (!res && maybeSelfReference) {
      // fallback to implicit self-reference
      return Component
    }

    if (__DEV__ && warnMissing && !res) {
      const extra =
        type === COMPONENTS
          ? `\nIf this is a native custom element, make sure to exclude it from ` +
          `component resolution via compilerOptions.isCustomElement.`
          : ``
      warn(`Failed to resolve ${type.slice(0, -1)}: ${name}${extra}`)
    }

    return res
  } else if (__DEV__) {
    warn(
      `resolve${capitalize(type.slice(0, -1))} ` +
      `can only be used in render() or setup().`,
    )
  }
}


function convertLegacySlots(vnode: VNode): VNode {
  const { props, children } = vnode

  let slots: Record<string, any> | undefined

  if (vnode.shapeFlag & ShapeFlags.COMPONENT && isArray(children)) {
    slots = {}
    // check "slot" property on vnodes and turn them into v3 function slots
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      const slotName =
        (isVNode(child) && child.props && child.props.slot) || 'default'
      const slot = slots[slotName] || (slots[slotName] = [] as any[])
      if (isVNode(child) && child.type === 'template') {
        slot.push(child.children)
      } else {
        slot.push(child)
      }
    }
    if (slots) {
      for (const key in slots) {
        const slotChildren = slots[key]
        slots[key] = () => slotChildren
        slots[key]._ns = true /* non-scoped slot */
      }
    }
  }

  const scopedSlots = props && props.scopedSlots
  if (scopedSlots) {
    delete props!.scopedSlots
    if (slots) {
      extend(slots, scopedSlots)
    } else {
      slots = scopedSlots
    }
  }

  if (slots) {
    normalizeChildren(vnode, slots)
  }

  return vnode
}


function convertLegacyDirectives(
  vnode: VNode,
  props?: LegacyVNodeProps,
): VNode {
  if (props && props.directives) {
    return withDirectives(
      vnode,
      props.directives.map(({ name, value, arg, modifiers }) => {
        return [
          resolveDirective(name)!,
          value,
          arg,
          modifiers,
        ] as DirectiveArguments[number]
      }),
    )
  }
  return vnode
}

function convertLegacyProps(
  legacyProps: LegacyVNodeProps | undefined,
  type: any,
): (Data & VNodeProps) | null {
  if (!legacyProps) {
    return null
  }

  const converted: Data & VNodeProps = {}

  for (const key in legacyProps) {
    if (key === 'attrs' || key === 'domProps' || key === 'props') {
      extend(converted, legacyProps[key])
    } else if (key === 'on' || key === 'nativeOn') {
      const listeners = legacyProps[key]
      for (const event in listeners) {
        let handlerKey = convertLegacyEventKey(event)
        if (key === 'nativeOn') handlerKey += `Native`
        const existing = converted[handlerKey]
        const incoming = listeners[event]
        if (existing !== incoming) {
          if (existing) {
            converted[handlerKey] = [].concat(existing as any, incoming as any)
          } else {
            converted[handlerKey] = incoming
          }
        }
      }
    } else if (!skipLegacyRootLevelProps(key)) {
      converted[key] = legacyProps[key as keyof LegacyVNodeProps]
    }
  }

  if (legacyProps.staticClass) {
    converted.class = normalizeClass([legacyProps.staticClass, converted.class])
  }
  if (legacyProps.staticStyle) {
    converted.style = normalizeStyle([legacyProps.staticStyle, converted.style])
  }

  if (legacyProps.model && isObject(type)) {
    // v2 compiled component v-model
    const { prop = 'value', event = 'input' } = (type as any).model || {}
    converted[prop] = legacyProps.model.value
    converted[compatModelEventPrefix + event] = legacyProps.model.callback
  }

  return converted
}


/**
 * Adds directives to a VNode.
 */
export function withDirectives<T extends VNode>(
  vnode: T,
  directives: DirectiveArguments,
): T {
  if (currentRenderingInstance === null) {
    __DEV__ && warn(`withDirectives can only be used inside render functions.`)
    return vnode
  }
  const instance = getComponentPublicInstance(currentRenderingInstance)
  const bindings: DirectiveBinding[] = vnode.dirs || (vnode.dirs = [])
  for (let i = 0; i < directives.length; i++) {
    let [dir, value, arg, modifiers = EMPTY_OBJ] = directives[i]
    if (dir) {
      if (isFunction(dir)) {
        dir = {
          mounted: dir,
          updated: dir,
        } as ObjectDirective
      }
      if (dir.deep) {
        traverse(value)
      }
      bindings.push({
        dir,
        instance,
        value,
        oldValue: void 0,
        arg,
        modifiers,
      })
    }
  }
  return vnode
}

function convertLegacyEventKey(event: string): string {
  // normalize v2 event prefixes
  if (event[0] === '&') {
    event = event.slice(1) + 'Passive'
  }
  if (event[0] === '~') {
    event = event.slice(1) + 'Once'
  }
  if (event[0] === '!') {
    event = event.slice(1) + 'Capture'
  }
  return toHandlerKey(event)
}

/**
 * @private
 */
export function resolveDirective(name: string): Directive | undefined {
  return resolveAsset(DIRECTIVES, name)
}


function resolve(registry: Record<string, any> | undefined, name: string) {
  return (
    registry &&
    (registry[name] ||
      registry[camelize(name)] ||
      registry[capitalize(camelize(name))])
  )
}


export function forEachElement(
  node: Node,
  cb: (el: Element) => void | false,
): void {
  // fragment
  if (isComment(node) && node.data === '[') {
    let depth = 1
    let next = node.nextSibling
    while (next) {
      if (next.nodeType === DOMNodeTypes.ELEMENT) {
        const result = cb(next as Element)
        if (result === false) {
          break
        }
      } else if (isComment(next)) {
        if (next.data === ']') {
          if (--depth === 0) break
        } else if (next.data === '[') {
          depth++
        }
      }
      next = next.nextSibling
    }
  } else {
    cb(node as Element)
  }
}

function defineReactiveSimple(obj: any, key: string, val: any) {
  val = isObject(val) ? reactive(val) : val
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get() {
      track(obj, TrackOpTypes.GET, key)
      return val
    },
    set(newVal) {
      val = isObject(newVal) ? reactive(newVal) : newVal
      trigger(obj, TriggerOpTypes.SET, key, newVal)
    },
  })
}


function defineReactive(obj: any, key: string, val: any) {
  // it's possible for the original object to be mutated after being defined
  // and expecting reactivity... we are covering it here because this seems to
  // be a bit more common.
  if (isObject(val) && !isReactive(val) && !patched.has(val)) {
    const reactiveVal = reactive(val)
    if (isArray(val)) {
      methodsToPatch.forEach((m: any) => {
        val[m] = (...args: any[]) => {
          Array.prototype[m].apply(reactiveVal, args)
        }
      })
    } else {
      Object.keys(val).forEach(key => {
        try {
          defineReactiveSimple(val, key, val[key])
        } catch (e: any) { }
      })
    }
  }

  const i = obj.$
  if (i && obj === i.proxy) {
    // target is a Vue instance - define on instance.ctx
    defineReactiveSimple(i.ctx, key, val)
    i.accessCache = Object.create(null)
  } else if (isReactive(obj)) {
    obj[key] = val
  } else {
    defineReactiveSimple(obj, key, val)
  }
}


// Legacy global Vue constructor
export function createCompatVue(
  createApp: CreateAppFunction<Element>,
  createSingletonApp: CreateAppFunction<Element>,
): CompatVue {
  singletonApp = createSingletonApp({})

  const Vue: CompatVue = (singletonCtor = function Vue(
    options: ComponentOptions = {},
  ) {
    return createCompatApp(options, Vue)
  } as any)

  function createCompatApp(options: ComponentOptions = {}, Ctor: any) {
    assertCompatEnabled(DeprecationTypes.GLOBAL_MOUNT, null)

    const { data } = options
    if (
      data &&
      !isFunction(data) &&
      softAssertCompatEnabled(DeprecationTypes.OPTIONS_DATA_FN, null)
    ) {
      options.data = () => data
    }

    const app = createApp(options)

    if (Ctor !== Vue) {
      applySingletonPrototype(app, Ctor)
    }

    const vm = app._createRoot!(options)
    if (options.el) {
      return (vm as any).$mount(options.el)
    } else {
      return vm
    }
  }

  Vue.version = `2.6.14-compat:${__VERSION__}`
  Vue.config = singletonApp.config

  Vue.use = (plugin: Plugin, ...options: any[]) => {
    if (plugin && isFunction(plugin.install)) {
      plugin.install(Vue as any, ...options)
    } else if (isFunction(plugin)) {
      plugin(Vue as any, ...options)
    }
    return Vue
  }

  Vue.mixin = m => {
    singletonApp.mixin(m)
    return Vue
  }

  Vue.component = ((name: string, comp: Component) => {
    if (comp) {
      singletonApp.component(name, comp)
      return Vue
    } else {
      return singletonApp.component(name)
    }
  }) as any

  Vue.directive = ((name: string, dir: Directive | LegacyDirective) => {
    if (dir) {
      singletonApp.directive(name, dir as Directive)
      return Vue
    } else {
      return singletonApp.directive(name)
    }
  }) as any

  Vue.options = { _base: Vue }

  let cid = 1
  Vue.cid = cid

  Vue.nextTick = nextTick

  const extendCache = new WeakMap()

  function extendCtor(this: any, extendOptions: ComponentOptions = {}) {
    assertCompatEnabled(DeprecationTypes.GLOBAL_EXTEND, null)
    if (isFunction(extendOptions)) {
      extendOptions = extendOptions.options
    }

    if (extendCache.has(extendOptions)) {
      return extendCache.get(extendOptions)
    }

    const Super = this
    function SubVue(inlineOptions?: ComponentOptions) {
      if (!inlineOptions) {
        return createCompatApp(SubVue.options, SubVue)
      } else {
        return createCompatApp(
          mergeOptions(
            extend({}, SubVue.options),
            inlineOptions,
            internalOptionMergeStrats as any,
          ),
          SubVue,
        )
      }
    }
    SubVue.super = Super
    SubVue.prototype = Object.create(Vue.prototype)
    SubVue.prototype.constructor = SubVue

    // clone non-primitive base option values for edge case of mutating
    // extended options
    const mergeBase: any = {}
    for (const key in Super.options) {
      const superValue = Super.options[key]
      mergeBase[key] = isArray(superValue)
        ? superValue.slice()
        : isObject(superValue)
          ? extend(Object.create(null), superValue)
          : superValue
    }

    SubVue.options = mergeOptions(
      mergeBase,
      extendOptions,
      internalOptionMergeStrats as any,
    )

    SubVue.options._base = SubVue
    SubVue.extend = extendCtor.bind(SubVue)
    SubVue.mixin = Super.mixin
    SubVue.use = Super.use
    SubVue.cid = ++cid

    extendCache.set(extendOptions, SubVue)
    return SubVue
  }

  Vue.extend = extendCtor.bind(Vue) as any

  Vue.set = (target, key, value) => {
    assertCompatEnabled(DeprecationTypes.GLOBAL_SET, null)
    target[key] = value
  }

  Vue.delete = (target, key) => {
    assertCompatEnabled(DeprecationTypes.GLOBAL_DELETE, null)
    delete target[key]
  }

  Vue.observable = (target: any) => {
    assertCompatEnabled(DeprecationTypes.GLOBAL_OBSERVABLE, null)
    return reactive(target)
  }

  Vue.filter = ((name: string, filter?: any) => {
    if (filter) {
      singletonApp.filter!(name, filter)
      return Vue
    } else {
      return singletonApp.filter!(name)
    }
  }) as any

  // internal utils - these are technically internal but some plugins use it.
  const util = {
    warn: __DEV__ ? warn : NOOP,
    extend,
    mergeOptions: (parent: any, child: any, vm?: ComponentPublicInstance) =>
      mergeOptions(
        parent,
        child,
        vm ? undefined : (internalOptionMergeStrats as any),
      ),
    defineReactive,
  }
  Object.defineProperty(Vue, 'util', {
    get() {
      assertCompatEnabled(DeprecationTypes.GLOBAL_PRIVATE_UTIL, null)
      return util
    },
  })

  Vue.configureCompat = configureCompat

  return Vue
}


const _compatUtils: {
  warnDeprecation: typeof warnDeprecation
  createCompatVue: typeof createCompatVue
  isCompatEnabled: typeof isCompatEnabled
  checkCompatEnabled: typeof checkCompatEnabled
  softAssertCompatEnabled: typeof softAssertCompatEnabled
} = {
  warnDeprecation,
  createCompatVue,
  isCompatEnabled,
  checkCompatEnabled,
  softAssertCompatEnabled,
}
/**
 * @internal only exposed in compat builds.
 */
export const compatUtils = (
  __COMPAT__ ? _compatUtils : null
) as typeof _compatUtils


export const RuntimeCompiledPublicInstanceProxyHandlers: ProxyHandler<any> =
  /*@__PURE__*/ extend({}, PublicInstanceProxyHandlers, {
  get(target: ComponentRenderContext, key: string) {
    // fast path for unscopables when using `with` block
    if ((key as any) === Symbol.unscopables) {
      return
    }
    return PublicInstanceProxyHandlers.get!(target, key, target)
  },
  has(_: ComponentRenderContext, key: string) {
    const has = key[0] !== '_' && !isGloballyAllowed(key)
    if (__DEV__ && !has && PublicInstanceProxyHandlers.has!(_, key)) {
      warn(
        `Property ${JSON.stringify(
          key,
        )} should not start with _ which is a reserved prefix for Vue internals.`,
      )
    }
    return has
  },
})


/**
 * For runtime-dom to register the compiler.
 * Note the exported method uses any to avoid d.ts relying on the compiler types.
 */
export function registerRuntimeCompiler(_compile: any): void {
  compile = _compile
  installWithProxy = i => {
    if (i.render!._rc) {
      i.withProxy = new Proxy(i.ctx, RuntimeCompiledPublicInstanceProxyHandlers)
    }
  }
}




// element
export function h<K extends keyof HTMLElementTagNameMap>(
  type: K,
  children?: RawChildren,
): VNode
export function h<K extends keyof HTMLElementTagNameMap>(
  type: K,
  props?: (RawProps & HTMLElementEventHandler) | null,
  children?: RawChildren | RawSlots,
): VNode

// custom element
export function h(type: string, children?: RawChildren): VNode
export function h(
  type: string,
  props?: RawProps | null,
  children?: RawChildren | RawSlots,
): VNode

// text/comment
export function h(
  type: typeof Text | typeof Comment,
  children?: string | number | boolean,
): VNode
export function h(
  type: typeof Text | typeof Comment,
  props?: null,
  children?: string | number | boolean,
): VNode
// fragment
export function h(type: typeof Fragment, children?: VNodeArrayChildren): VNode
export function h(
  type: typeof Fragment,
  props?: RawProps | null,
  children?: VNodeArrayChildren,
): VNode

// teleport (target prop is required)
export function h(
  type: typeof Teleport,
  props: RawProps & TeleportProps,
  children: RawChildren | RawSlots,
): VNode

// suspense
export function h(type: typeof Suspense, children?: RawChildren): VNode
export function h(
  type: typeof Suspense,
  props?: (RawProps & SuspenseProps) | null,
  children?: RawChildren | RawSlots,
): VNode

// functional component
export function h<
  P,
  E extends EmitsOptions = {},
  S extends Record<string, any> = any,
>(
  type: FunctionalComponent<P, any, S, any>,
  props?: (RawProps & P) | ({} extends P ? null : never),
  children?: RawChildren | IfAny<S, RawSlots, S>,
): VNode

// catch-all for generic component types
export function h(type: Component, children?: RawChildren): VNode

// concrete component
export function h<P>(
  type: ConcreteComponent | string,
  children?: RawChildren,
): VNode
export function h<P>(
  type: ConcreteComponent<P> | string,
  props?: (RawProps & P) | ({} extends P ? null : never),
  children?: RawChildren,
): VNode

// component without props
export function h<P>(
  type: Component<P>,
  props?: (RawProps & P) | null,
  children?: RawChildren | RawSlots,
): VNode

// exclude `defineComponent` constructors
export function h<P>(
  type: ComponentOptions<P>,
  props?: (RawProps & P) | ({} extends P ? null : never),
  children?: RawChildren | RawSlots,
): VNode

// fake constructor type returned by `defineComponent` or class component
export function h(type: Constructor, children?: RawChildren): VNode
export function h<P>(
  type: Constructor<P>,
  props?: (RawProps & P) | ({} extends P ? null : never),
  children?: RawChildren | RawSlots,
): VNode

// fake constructor type returned by `defineComponent`
export function h(type: DefineComponent, children?: RawChildren): VNode
export function h<P>(
  type: DefineComponent<P>,
  props?: (RawProps & P) | ({} extends P ? null : never),
  children?: RawChildren | RawSlots,
): VNode

// catch all types
export function h(type: string | Component, children?: RawChildren): VNode
export function h<P>(
  type: string | Component<P>,
  props?: (RawProps & P) | ({} extends P ? null : never),
  children?: RawChildren | RawSlots,
): VNode

// Actual implementation
export function h(type: any, propsOrChildren?: any, children?: any): VNode {
  const l = arguments.length
  if (l === 2) {
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      // single vnode without props
      if (isVNode(propsOrChildren)) {

        return createVNode(type, null, [propsOrChildren])
      }

      // props without children
      return createVNode(type, propsOrChildren)
    } else {

      // omit props
      return createVNode(type, null, propsOrChildren)
    }
  } else {
    if (l > 3) {
      children = Array.prototype.slice.call(arguments, 2)
    } else if (l === 3 && isVNode(children)) {
      children = [children]
    }


    return createVNode(type, propsOrChildren, children)
  }
}
