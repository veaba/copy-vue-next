/**
 * @bug webstorm 似乎存在 format 的错误
 * - resolveMergedOptions
 * */
import {
  computed,
  ComputedGetter,
  proxyRefs,
  reactive,
  toRaw,
  toRef,
  WritableComputedOptions
} from '@vue/reactivity'
import {
  Component,
  ComponentInternalInstance,
  ComponentInternalOptions,
  ConcreteComponent,
  Data,
  InternalRenderFunction,
  LifecycleHooks,
  SetupContext
} from './component'
import { EmitsOptions } from './componentEmits'
import {
  ComponentPublicInstance,
  CreateComponentPublicInstance
} from './componentPublicInstance'
import { Directive } from './directives'
import { watch, WatchCallback, WatchOptions } from './apiWatch'
import {
  DebuggerHook,
  ErrorCapturedHook,
  onActivated,
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onDeactivated,
  onErrorCaptured,
  onMounted,
  onRenderTracked,
  onRenderTriggered,
  onUnmounted,
  onUpdated
} from './apiLifecycle'
import { VNodeChild } from './vnode'
import {
  EMPTY_OBJ,
  extend,
  hasOwn,
  isArray,
  isFunction,
  isObject,
  isPromise,
  isString,
  NOOP
} from '@vue/shared'
import {
  ComponentObjectPropsOptions,
  ExtractDefaultPropTypes,
  ExtractPropTypes
} from './componentProps'
import { warn } from './warning'
import { callWithAsyncErrorHandling } from './errorHanding'
import { inject, provide } from './apiInject'

/**
 * Interface for declaring custom options.
 *
 * @example
 * ```ts
 * declare module '@vue/runtime-core' {
 *   interface ComponentCustomOptions {
 *     beforeRouteUpdate?(
 *       to: Route,
 *       from: Route,
 *       next: () => void
 *     ): void
 *   }
 * }
 * ```
 */
export interface ComponentCustomOptions {}

export type RenderFunction = () => VNodeChild

const enum OptionTypes {
  PROPS = 'Props',
  DATA = 'Data',
  COMPUTED = 'Computed',
  METHODS = 'Methods',
  INJECT = 'Inject'
}

export interface ComponentOptionsBase<
  Props,
  RawBindings,
  D,
  C extends ComputedOptions,
  M extends MethodOptions,
  Mixin extends ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin,
  E extends EmitsOptions,
  EE extends string = string,
  Defaults = {}
>
  extends LegacyOptions<Props, D, C, M, Mixin, Extends>,
    ComponentInternalOptions,
    ComponentCustomOptions {
  setup?: (
    this: void,
    props: Props,
    ctx: SetupContext<E, Props>
  ) => Promise<RawBindings> | RawBindings | RenderFunction | void
  name?: string
  template?: string | object // 可以是直接 DOM
  // Note: we are intentionally using the signature-less `Function` type here
  // since any type with signature will cause the whole inference to fail when
  // the return expression contains reference to `this`.
  // Luckily `render()` doesn't need any arguments nor does it care about return
  // type.
  render?: Function
  components?: Record<string, Component>
  directives?: Record<string, Directive>
  inheritAttrs?: boolean
  emits?: (E | EE[]) & ThisType<void>
  //  TODO: 根据暴露的密钥来推断公共实例类型
  expose?: string[]

  serverPrefetch?(): Promise<any>

  // Internal -----------------------------------------
  /**
   * 仅SSR
   * 这是由 compiler-ssr产生的，附在 compile-sfc中
   * 不是面向用户的，所以编写不严谨，仅供测试用。
   * @internal
   * */
  ssrRender?: (
    ctx: any,
    push: (item: any) => void,
    parentInstance: ComponentInternalInstance,
    attrs: Data | undefined,
    // 针对 compile-optimized bindings
    $props: ComponentInternalInstance['props'],
    $setup: ComponentInternalInstance['setupState'],
    $data: ComponentInternalInstance['data'],
    $options: ComponentInternalInstance['ctx']
  ) => void

  /**
   * 仅由 compile-sfc生成，用于标记一个内联的 ssr 渲染函数，并从setup()返回。
   * @internal
   * */
  __ssrInlineRender?: boolean
  /**
   * AsyncComponentWrapper 标记
   * @internal
   * */
  __asyncLoader?: () => Promise<ConcreteComponent>
  /**
   * cache for merged $options
   * @internal
   */
  __merged?: ComponentOptions
  // Type 声明 -----------------------------------------
  // 请注意，这些都是内部的，但需要在d.ts中暴露出来，以便进行类型推理。

  // 纯类型区分符，将 OptionWithoutProps 与 defineComponent() 或 FunctionalComponent 返回的构造函数类型分开。
  call?: (this: unknown, ...args: unknown[]) => never
  // 内建Vnode类型的类型区分器。
  __isFragment?: never
  __isTeleport?: never
  __isSuspense?: never

  __defaults?: Defaults
}

export type ComponentOptionsWithoutProps<
  Props = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = EmitsOptions,
  EE extends string = string
> = ComponentOptionsBase<
  Props,
  RawBindings,
  D,
  C,
  M,
  Mixin,
  Extends,
  E,
  EE,
  {}
> & {
  props?: undefined
} & ThisType<
    CreateComponentPublicInstance<{}, RawBindings, D, C, M, Mixin, Extends, E>
  >
export type ComponentOptionsWithArrayProps<
  PropNames extends string = string,
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = EmitsOptions,
  EE extends string = string,
  Props = Readonly<{ [key in PropNames]?: any }>
> = ComponentOptionsBase<
  Props,
  RawBindings,
  D,
  C,
  M,
  Mixin,
  Extends,
  E,
  EE,
  {}
> & {
  props: PropNames[]
} & ThisType<
    CreateComponentPublicInstance<
      Props,
      RawBindings,
      D,
      C,
      M,
      Mixin,
      Extends,
      E
    >
  >
export type ComponentOptionsWithObjectProps<
  PropsOptions = ComponentObjectPropsOptions,
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = EmitsOptions,
  EE extends string = string,
  Props = Readonly<ExtractPropTypes<PropsOptions>>,
  Defaults = ExtractDefaultPropTypes<PropsOptions>
> = ComponentOptionsBase<
  Props,
  RawBindings,
  D,
  C,
  M,
  Mixin,
  Extends,
  E,
  EE,
  Defaults
> & {
  props: PropsOptions & ThisType<void>
} & ThisType<
    CreateComponentPublicInstance<
      Props,
      RawBindings,
      D,
      C,
      M,
      Mixin,
      Extends,
      E,
      Props,
      Defaults,
      false
    >
  >

export type ComponentOptions<
  Props = {},
  RawBindings = any,
  D = any,
  C extends ComputedOptions = any,
  M extends MethodOptions = any,
  Mixin extends ComponentOptionsMixin = any,
  Extends extends ComponentOptionsMixin = any,
  E extends EmitsOptions = any
> = ComponentOptionsBase<Props, RawBindings, D, C, M, Mixin, Extends, E> &
  ThisType<
    CreateComponentPublicInstance<
      {},
      RawBindings,
      D,
      C,
      M,
      Mixin,
      Extends,
      E,
      Readonly<Props>
    >
  >
export type ComponentOptionsMixin = ComponentOptionsBase<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>

export type ComputedOptions = Record<
  string,
  ComputedGetter<any> | WritableComputedOptions<any>
>

export interface MethodOptions {
  [key: string]: Function
}

export type ExtractComputedReturns<T extends any> = {
  [key in keyof T]: T[key] extends { get: (...args: any[]) => infer TReturn }
    ? TReturn
    : T[key] extends (...args: any[]) => infer TReturn ? TReturn : never
}

type WatchOptionItem =
  | string
  | WatchCallback
  | ({ handler: WatchCallback | string } & WatchOptions)
type ComponentWatchOptionItem = WatchOptionItem | WatchOptionItem[]
type ComponentWatchOptions = Record<string, ComponentWatchOptionItem>

type ComponentInjectOptions =
  | string[]
  | Record<
      string | symbol,
      string | symbol | { from?: string | symbol; default?: unknown }
    >

interface LegacyOptions<
  Props,
  D,
  C extends ComputedOptions,
  M extends MethodOptions,
  Mixin extends ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin
> {
  // 允许任何自定义选项
  [key: string]: any

  // state
  // 限制：我们不能在 data 的 `this` 上下文上暴露 RawBindings，因为这会导致某种循环推断，并破坏整个组件的ThisType。
  data?: (
    this: CreateComponentPublicInstance<Props>,
    vm: CreateComponentPublicInstance<Props>
  ) => D
  computed?: C
  methods?: M
  watch?: ComponentWatchOptions
  provide?: Data | Function
  inject?: ComponentInjectOptions

  // composition
  mixins?: Mixin[]
  extends?: Extends

  // lifecycle

  beforeCreate?(): void

  created?(): void

  beforeMount?(): void

  mounted?(): void

  beforeUpdate?(): void

  updated?(): void

  beforeUnmount?(): void

  unmounted?(): void

  activated?(): void

  deactivated?(): void

  /** @deprecated 使用 `beforeUnmount` 替代，不久的将来移除 */
  beforeDestroy?(): void

  /** @deprecated 使用 `unmounted` 替代，不久的将来移除 */
  destroyed?(): void

  renderTracked?: DebuggerHook
  renderTriggered?: DebuggerHook
  errorCaptured?: ErrorCapturedHook

  // 仅用于runtime compile
  delimiters?: [string, string]
}

export type OptionTypesKeys = 'P' | 'B' | 'D' | 'C' | 'M' | 'Defaults'

export type OptionTypesType<
  P = {},
  B = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Defaults = {}
> = {
  P: P
  B: B
  D: D
  C: C
  M: M
  Defaults: Defaults
}

export let isInBeforeCreate = false

export function resolveMergedOptions(
  instance: ComponentInternalInstance
): ComponentOptions {
  const raw = instance.type as ComponentOptions
  const { __merged, mixins, extends: extendsOptions } = raw
  if (__merged) return __merged
  const globalMixins = instance.appContext.mixins
  if (!globalMixins.length && !mixins && !extendsOptions) return raw
  const options = {}
  globalMixins.forEach(m => mergeOptions(options, m, instance))
  mergeOptions(options, raw, instance)
  return (raw.__merged = options)
}

function mergeOptions(to: any, from: any, instance: ComponentInternalInstance) {
  const strats = instance.appContext.config.optionMergeStrategies
  const { mixins, extends: extendsOptions } = from
  extendsOptions && mergeOptions(to, extendsOptions, instance)
  mixins &&
    mixins.forEach((m: ComponentOptionsMixin) => mergeOptions(to, m, instance))

  for (const key in from) {
    if (!from.hasOwnProperty(key)) continue
    if (strats && hasOwn(strats, key)) {
      to[key] = strats[key](to[key], from[key], instance.proxy, key)
    } else {
      to[key] = from[key]
    }
  }
}

type DataFn = (vm: ComponentPublicInstance) => any

function callHookFromMixins(
  name: 'beforeCreate' | 'created',
  type: LifecycleHooks,
  mixins: ComponentOptions[],
  instance: ComponentInternalInstance
) {
  for (let i = 0; i < mixins.length; i++) {
    const chainedMixins = mixins[i].mixins
    if (chainedMixins) {
      callHookFromMixins(name, type, chainedMixins, instance)
    }
    const fn = mixins[i][name]
    if (fn) {
      callWithAsyncErrorHandling(fn.bind(instance.proxy!), instance, type)
    }
  }
}

function callHookFromExtends(
  name: 'beforeCreate' | 'created',
  type: LifecycleHooks,
  base: ComponentOptions,
  instance: ComponentInternalInstance
) {
  if (base.extends) {
    callHookFromExtends(name, type, base.extends, instance)
  }
  const baseHook = base[name]
  if (baseHook) {
    callWithAsyncErrorHandling(baseHook.bind(instance.proxy!), instance, type)
  }
}

function callSyncHook(
  name: 'beforeCreate' | 'created',
  type: LifecycleHooks,
  options: ComponentOptions,
  instance: ComponentInternalInstance,
  globalMixins: ComponentOptions[]
) {
  callHookFromMixins(name, type, globalMixins, instance)
  const { extends: base, mixins } = options
  if (base) {
    callHookFromExtends(name, type, base, instance)
  }
  if (mixins) {
    callHookFromMixins(name, type, base, instance)
  }

  const selfHook = options[name]
  if (selfHook) {
    callWithAsyncErrorHandling(selfHook.bind(instance.proxy!), instance, type)
  }
}

function applyMixins(
  instance: ComponentInternalInstance,
  mixins: ComponentOptions[],
  deferredData: DataFn[],
  deferredWatch: ComponentWatchOptions[],
  deferredProvide: (Data | Function)[]
) {
  for (let i = 0; i < mixins.length; i++) {
    applyOptions(
      instance,
      mixins[i],
      deferredData,
      deferredWatch,
      deferredProvide,
      true
    )
  }
}

function createDuplicateChecker() {
  const cache = Object.create(null)
  return (type: OptionTypes, key: string) => {
    if (cache[key]) {
      warn(`${type} property "${key}" is already define in ${cache[key]}.`)
    } else {
      cache[key] = type
    }
  }
}

function createPathGetter(ctx: any, path: string) {
  const segments = path.split('.')
  return () => {
    let cur = ctx
    for (let i = 0; i < segments.length; i++) {
      cur = cur[segments[i]]
    }
    return cur
  }
}

function createWatcher(
  raw: ComponentWatchOptionItem,
  ctx: Data,
  publicThis: ComponentPublicInstance,
  key: string
) {
  const getter = key.includes('.')
    ? createPathGetter(publicThis, key)
    : () => (publicThis as any)[key]
  if (isString(raw)) {
    const handler = ctx[raw]
    if (isFunction(handler)) {
      watch(getter, handler as WatchCallback)
    } else if (__DEV__) {
      warn(`Invalid watch handler specified by key "${raw}"`, handler)
    }
  } else if (isFunction(raw)) {
    watch(getter, raw.bind(publicThis))
  } else if (isObject(raw)) {
    if (isArray(raw)) {
      raw.forEach(r => createWatcher(r, ctx, publicThis, key))
    } else {
      const handler = isFunction(raw.handler)
        ? raw.handler.bind(publicThis)
        : (ctx[raw.handler] as WatchCallback)

      if (isFunction(handler)) {
        watch(getter, handler, raw)
      } else if (__DEV__) {
        warn(`Invalid watch handler specified by key "${raw.handler}"`, handler)
      }
    }
  } else if (__DEV__) {
    warn(`Invalid watch options: "${key}"`, raw)
  }
}

function resolveData(
  instance: ComponentInternalInstance,
  dataFn: DataFn,
  publicThis: ComponentPublicInstance
) {
  if (__DEV__ && !isFunction(dataFn)) {
    warn(
      `The data option must be a function. ` +
        `Plain object usage is no longer supported.`
    )
  }
  const data = dataFn.call(publicThis, publicThis)
  if (__DEV__ && isPromise(data)) {
    warn(
      `data() returned a Promise - note data() cannot be async; If you ` +
        `intend to perform data fetching before component renders, use ` +
        `async setup() + <Suspense>.`
    )
  }

  if (!isObject(data)) {
    __DEV__ && warn(`data() should return an object`)
  } else if (instance.data === EMPTY_OBJ) {
    instance.data = reactive(data)
  } else {
    // existing data: this is a mixin or extends.
    extend(instance.data, data)
  }
}

export function applyOptions(
  instance: ComponentInternalInstance,
  options: ComponentOptions,
  deferredData: DataFn[] = [],
  deferredWatch: ComponentWatchOptions[] = [],
  deferredProvide: (Data | Function)[] = [],
  asMixin: boolean = false
) {
  const {
    // composition
    mixins,
    extends: extendsOptions,
    // state
    data: dataOptions,
    computed: computedOptions,
    methods,
    watch: watchOptions,
    provide: provideOptions,
    inject: injectOptions,
    // assets
    components,
    directives,
    // lifecylce
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
    // public API
    expose
  } = options
  const publicThis = instance.proxy!
  const ctx = instance.ctx
  const globalMixins = instance.appContext.mixins

  if (asMixin && render && instance.render === NOOP) {
    instance.render = render as InternalRenderFunction
  }
  // applyOptions在每个实例中被 非 as-mixin 调用一次。
  if (!asMixin) {
    isInBeforeCreate = true
    callSyncHook(
      'beforeCreate',
      LifecycleHooks.BEFORE_CREATE,
      options,
      instance,
      globalMixins
    )
    isInBeforeCreate = false
    // global mixins 首先被应用
    applyMixins(
      instance,
      globalMixins,
      deferredData,
      deferredWatch,
      deferredProvide
    )
  }

  // 拓展基础组件
  if (extendsOptions) {
    applyOptions(
      instance,
      extendsOptions,
      deferredData,
      deferredWatch,
      deferredWatch,
      true
    )
  }
  // local mixins
  if (mixins) {
    applyMixins(instance, mixins, deferredData, deferredWatch, deferredProvide)
  }
  const checkDuplicateProperties = __DEV__ ? createDuplicateChecker() : null

  if (__DEV__) {
    const [propsOptions] = instance.propsOptions
    if (propsOptions) {
      for (const key in propsOptions) {
        checkDuplicateProperties!(OptionTypes.PROPS, key)
      }
    }
  }

  // 选项初始化顺序（与Vue 2一致）。
  // - props (已在此功能之外完成)
  // - inject
  // - methods
  // - data (因为它依赖于 `this` 访问，所以被推迟。)
  // - computed
  // - watch (因为它依赖于 `this` 访问，所以被推迟。)

  if (injectOptions) {
    if (isArray(injectOptions)) {
      for (let i = 0; i < injectOptions.length; i++) {
        const key = injectOptions[i]
        ctx[key] = inject(key)
        if (__DEV__) {
          checkDuplicateProperties!(OptionTypes.INJECT, key)
        }
      }
    } else {
      for (const key in injectOptions) {
        const opt = injectOptions[key]
        if (isObject(opt)) {
          ctx[key] = inject(
            opt.from || key,
            opt.default,
            true /* 将默认功能视为工厂函数 */
          )
        } else {
          ctx[key] = inject(opt)
        }
        if (__DEV__) {
          checkDuplicateProperties!(OptionTypes.INJECT, key)
        }
      }
    }
  }

  if (methods) {
    for (const key in methods) {
      const methodHandler = (methods as MethodOptions)[key]
      if (isFunction(methodHandler)) {
        ctx[key] = methodHandler.bind(publicThis)
        if (__DEV__) {
          checkDuplicateProperties!(OptionTypes.METHODS, key)
        }
      } else if (__DEV__) {
        warn(
          `Method "${key}" has type "${typeof methodHandler}" in the component definition. ` +
            `Did you reference the function correctly?`
        )
      }
    }
  }

  if (!asMixin) {
    if (deferredData.length) {
      deferredData.forEach(dataFn => resolveData(instance, dataFn, publicThis))
    }

    if (dataOptions) {
      resolveData(instance, dataOptions, publicThis)
    }
    if (__DEV__) {
      const rawData = toRaw(instance.data)
      for (const key in rawData) {
        checkDuplicateProperties!(OptionTypes.DATA, key)
        // 暴露 data 在 dev 期间 ctx
        if (key[0] !== '$' && key[0] !== '_') {
          Object.defineProperty(ctx, key, {
            configurable: true,
            enumerable: true,
            get: () => rawData[key],
            set: NOOP
          })
        }
      }
    }
  } else if (dataOptions) {
    deferredData.push(dataOptions as DataFn)
  }

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
                  `Write operation failed: computed property "${key}" is readonly.`
                )
              }
            : NOOP
      const c = computed({
        get,
        set
      })
      Object.defineProperty(ctx, key, {
        enumerable: true,
        configurable: true,
        get: () => c.value,
        set: v => (c.value = v)
      })
      if (__DEV__) {
        checkDuplicateProperties!(OptionTypes.COMPUTED, key)
      }
    }
  }
  if (watchOptions) {
    deferredWatch.push(watchOptions)
  }
  if (!asMixin && deferredWatch.length) {
    deferredWatch.forEach(watchOptions => {
      for (const key in watchOptions) {
        createWatcher(watchOptions[key], ctx, publicThis, key)
      }
    })
  }

  if (provideOptions) {
    deferredProvide.push(provideOptions)
  }

  if (!asMixin && deferredProvide.length) {
    deferredProvide.forEach(provideOptions => {
      const provides = isFunction(provideOptions)
        ? provideOptions.call(publicThis)
        : provideOptions
      for (const key in provides) {
        provide(key, provides[key])
      }
    })
  }
  // asset options
  // 为了减少内存的使用，只有带有 mixins 或 extends 的组件才会有解析的 asset 注册表附加到实例上。
  if (asMixin) {
    if (components) {
      extend(
        instance.components ||
          ((instance.components = extend(
            {},
            (instance.type as ComponentOptions).components
          ) as Record<string, ConcreteComponent>),
          components)
      )
    }

    if (directives) {
      extend(
        instance.directives ||
          (instance.directives = extend(
            {},
            (instance.type as ComponentOptions).directives
          )),
        directives
      )
    }
  }

  // lifecycle options
  if (!asMixin) {
    callSyncHook(
      'created',
      LifecycleHooks.CREATED,
      options,
      instance,
      globalMixins
    )
  }

  if (beforeMount) {
    onBeforeMount(beforeMount.bind(publicThis))
  }

  if (mounted) {
    onMounted(mounted.bind(publicThis))
  }

  if (beforeUpdate) {
    onBeforeUpdate(beforeUpdate.bind(publicThis))
  }

  if (updated) {
    onUpdated(updated.bind(publicThis))
  }

  if (activated) {
    onActivated(activated.bind(publicThis))
  }

  if (deactivated) {
    onDeactivated(deactivated.bind(publicThis))
  }

  if (errorCaptured) {
    onErrorCaptured(errorCaptured.bind(publicThis))
  }

  if (renderTracked) {
    onRenderTracked(renderTracked.bind(publicThis))
  }

  if (renderTriggered) {
    onRenderTriggered(renderTriggered.bind(publicThis))
  }

  if (__DEV__ && beforeDestroy) {
    warn(`\`beforeDestroy\` has been renamed to \`beforeUnmount\`.`)
  }

  if (beforeUnmount) {
    onBeforeUnmount(beforeUnmount.bind(publicThis))
  }
  if (__DEV__ && destroyed) {
    warn(`\`destroyed\` has been renamed to \`unmounted\`.`)
  }
  if (unmounted) {
    onUnmounted(unmounted.bind(publicThis))
  }

  if (isArray(expose)) {
    if (!asMixin) {
      if (expose.length) {
        const exposed = instance.exposed || (instance.exposed = proxyRefs({}))
        expose.forEach(key => {
          exposed[key] = toRef(publicThis, key as any)
        })
      } else if (!instance.exposed) {
        instance.exposed = EMPTY_OBJ
      }
    } else if (__DEV__) {
      warn(`The \`expose\` option is ignored when used in mixins.`)
    }
  }
}
