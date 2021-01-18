// 在 proxy 上暴露的公共属性，在模板中作为渲染上下文使用（在渲染选项中作为`this`）。

import {
  ComponentOptionsBase,
  ComponentOptionsMixin,
  ComputedOptions, ExtractComputedReturns, isInBeforeCreate,
  MethodOptions, OptionTypesKeys, OptionTypesType, resolveMergedOptions
} from './componentOptions'
import { EmitFn, EmitsOptions } from './componentEmits'
import { ComponentInternalInstance, Data } from './component'
import {
  ReactiveEffect,
  ReactiveFlags,
  shallowReadonly,
  ShallowUnwrapRef,
  toRaw,
  track,
  TrackOpTypes
} from '@vue/reactivity'
import { Slots } from './componentSlots'
import { isGloballyWhitelisted, EMPTY_OBJ, extend, hasOwn, isString, NOOP } from '@vue/shared'
import { UnionToIntersection } from './helpers/typeUtils'
import { nextTick, queueJob } from './scheduler'
import { instanceWatch, WatchOptions, WatchStopHandle } from './apiWatch'
import { warn } from './warning'
import { currentRenderingInstance, markAttrsAccessed } from './componentRenderUtils'

export interface ComponentRenderContext {
  [key: string]: any

  _: ComponentInternalInstance
}

const enum AccessTypes {
  SETUP,
  DATA,
  PROPS,
  CONTEXT,
  OTHER
}

type PublicPropertiesMap = Record<string, (i: ComponentInternalInstance) => any>
const publicPropertiesMap: PublicPropertiesMap = extend(Object.create(null), {
  $: i => i,
  $el: i => i.vnode.el,
  $data: i => i.data,
  $props: i => (__DEV__ ? shallowReadonly(i.props) : i.props),
  $attrs: i => (__DEV__ ? shallowReadonly(i.attrs) : i.attrs),
  $slots: i => (__DEV__ ? shallowReadonly(i.slots) : i.slots),
  $refs: i => (__DEV__ ? shallowReadonly(i.refs) : i.refs),
  $parent: i => i.parent && i.parent.proxy,
  $root: i => i.root && i.root.proxy,
  $emit: i => i.emit,
  $options: i => (__FEATURE_OPTIONS_API__ ? resolveMergedOptions(i) : i.type),
  $forceUpdate: i => () => queueJob(i.update),
  $nextTick: i => nextTick.bind(i.proxy!),
  $watch: i => (__FEATURE_OPTIONS_API__ ? instanceWatch.bind(i) : NOOP)
} as PublicPropertiesMap)

export interface ComponentCustomProperties {
}

export type ComponentPublicInstance<P = {},
  B = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  E extends EmitsOptions = {},
  PublicProps = P,
  Defaults = {},
  MakeDefaultsOptional extends boolean = false,
  Options = ComponentOptionsBase<any, any, any, any, any, any, any, any, any, any>> = {
  $: ComponentInternalInstance
  $data: D
  $props: MakeDefaultsOptional extends true
    ? Partial<Defaults> & Omit<P & PublicProps, keyof Defaults>
    : P & PublicProps
  $attrs: Data
  $refs: Data
  $slots: Slots
  $root: ComponentPublicInstance | null
  $parent: ComponentPublicInstance | null
  $emit: EmitFn<E>
  $el: any
  $options: Options
  $forceUpdate: ReactiveEffect
  $nextTick: typeof nextTick
  $watch(
    source: string | Function,
    cb: Function,
    options?: WatchOptions
  ): WatchStopHandle
} & P & ShallowUnwrapRef<B> & D & ExtractComputedReturns<C> & M & ComponentCustomProperties

// 在dev模式下，proxy 目标暴露了与`this`相同的属性，以便于控制台检查。在prod模式下，它将是一个空对象，所以这些属性定义可以跳过。
export function createRenderContext(instance: ComponentInternalInstance) {
  const target: Record<string, any> = {}

  // 对于 proxy handler 暴露内部的实例
  Object.defineProperty(target, `_`, {
    configurable: true,
    enumerable: false,
    get: () => instance
  })

  // 暴露公共的 property
  Object.keys(publicPropertiesMap).forEach(key => {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: false,
      get: () => publicPropertiesMap[key](instance),
      // 被 proxy 拦截，所以不需要实现，但需要访问 set 错误
      set: NOOP
    })
  })
  return target as ComponentRenderContext
}

type IsDefaultMixinComponent<T> = T extends ComponentOptionsMixin ? ComponentOptionsMixin extends T ? true : false : false
type MixinToOptionsTypes<T> = T extends ComponentOptionsBase<infer P,
  infer B,
  infer D,
  infer C,
  infer M,
  infer Mixin,
  infer Extends,
  any,
  any,
  infer Defaults> ? OptionTypesType<P & {}, B & {}, D & {}, C & {}, M & {}, Defaults & {}> & IntersectionMixin<Mixin> & IntersectionMixin<Extends> : never
// ExtractMixin(map type) 用来解决循环引用的
type ExtractMixin<T> = {
  Mixin: MixinToOptionsTypes<T>
}[T extends ComponentOptionsMixin ? 'Mixin' : never]

type IntersectionMixin<T> = IsDefaultMixinComponent<T> extends true
  ? OptionTypesType<{}, {}, {}, {}, {}> : UnionToIntersection<ExtractMixin<T>>

type UnwrapMixinsType<T, Type extends OptionTypesKeys> = T extends OptionTypesType ? T[Type] : never
type EnsureNonVoid<T> = T extends void ? {} : T
export type CreateComponentPublicInstance<P = {},
  B = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = {},
  PublicProps = P,
  Defaults = {},
  MakeDefaultsOptional extends boolean = false,
  PublicMixin = IntersectionMixin<Mixin> & IntersectionMixin<Extends>,
  PublicP = UnwrapMixinsType<PublicMixin, 'P'> & EnsureNonVoid<P>,
  PublicB = UnwrapMixinsType<PublicMixin, 'B'> & EnsureNonVoid<B>,
  PublicD = UnwrapMixinsType<PublicMixin, 'D'> & EnsureNonVoid<D>,
  PublicC extends ComputedOptions = UnwrapMixinsType<PublicMixin, 'C'> & EnsureNonVoid<C>,
  PublicM extends MethodOptions = UnwrapMixinsType<PublicMixin, 'M'> & EnsureNonVoid<M>,
  PublicDefaults = UnwrapMixinsType<PublicMixin, 'Defaults'> & EnsureNonVoid<Defaults>>
  = ComponentPublicInstance<PublicP,
  PublicB,
  PublicD,
  PublicC,
  PublicM,
  E,
  PublicProps,
  PublicDefaults,
  MakeDefaultsOptional,
  ComponentOptionsBase<P, B, D, C, M, Mixin, Extends, E, string, Defaults>>

export type ComponentPublicInstanceConstructor<T extends ComponentPublicInstance<Props,
  RawBindings,
  D,
  C,
  M> = ComponentPublicInstance<any>,
  Props = any,
  RawBindings = any,
  D = any,
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions> = {
  __isFragment?: never,
  __isTeleport?: never,
  __isSuspense?: never
  new(...args: any[]): T
}

/**
 * @dev only
 * */
export function exposePropsOnRenderContext(
  instance: ComponentInternalInstance
) {
  const { ctx, propsOptions: [propsOptions] } = instance
  if (propsOptions) {
    Object.keys(propsOptions).forEach(key => {
      Object.defineProperty(ctx, key, {
        enumerable: true,
        configurable: true,
        get: () => instance.props[key],
        set: NOOP
      })
    })
  }
}


/**
 * @dev only
 * */
export function exposeSetupStateOnRenderContext(
  instance: ComponentInternalInstance
) {
  const { ctx, setupState } = instance
  Object.keys(toRaw(setupState)).forEach(key => {
    if (key[0] === '$' || key[0] === '_') {
      warn(
        `setup() return property ${JSON.stringify(
          key
        )} should not start with "$" or "_" ` +
        `which are reserved prefixes for Vue internals.`
      )
      return
    }
    Object.defineProperty(ctx, key, {
      enumerable: true,
      configurable: true,
      get: () => setupState[key],
      set: NOOP
    })
  })
}

export const PublicInstanceProxyHandlers: ProxyHandler<any> = {
  get({ _: instance }: ComponentRenderContext, key: string) {
    const {
      ctx,
      setupState,
      data,
      props,
      accessCache,
      type,
      appContext
    } = instance

    // 让@vue/reactivity知道它不应该观察Vue公共实例。
    if (key === ReactiveFlags.SKIP) {
      return true
    }

    // 让内部格式化知道这是一个Vue实例。
    if (__DEV__ && key === '__isVue') {
      return true
    }
    // data / props / ctx
    // 在渲染过程中，渲染上下文上的每个属性访问都会被调用这个getter，是一大热点。其中最费劲的是多次调用hasOwn()。
    // 在一个普通对象上进行访问，所以我们使用一个accessCache对象（原型为null）来记忆一个 key 所对应的访问类型。
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
        }
        // TODO: bug 这里似乎无法比较？
      } else if (setupState !== EMPTY_OBJ && hasOwn(setupState, key)) {
        accessCache![key] = AccessTypes.SETUP
        return setupState[key]
      } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
        accessCache![key] = AccessTypes.DATA
        return data[key]
      } else if (
        // 只有当实例声明后，才会缓存其他属性（因此稳定）props
        (normalizedProps = instance.propsOptions[0]) &&
        hasOwn(normalizedProps, key)
      ) {
        accessCache![key] = AccessTypes.PROPS
        return props![key]
      } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
        accessCache![key] = AccessTypes.CONTEXT
        return ctx[key]
      } else if (!__FEATURE_OPTIONS_API__ || !isInBeforeCreate) {
        accessCache![key] = AccessTypes.OTHER
      }
    }
    const publicGetter = publicPropertiesMap[key]
    let cssModule, globalProperties

    // Public $xxx properties
    if (publicGetter) {
      if (key === '$attrs') {
        track(instance, TrackOpTypes.GET, key)
        __DEV__ && markAttrsAccessed()
      }
      return publicGetter(instance)
    } else if (
      // css module (通过 vue-loader 注入)
      (cssModule = type.__cssModules) &&
      (cssModule = cssModule[key])
    ) {
      return cssModule
    } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
      // 用户可以为`this`设置以`$`开头的自定义属性。
      accessCache![key] = AccessTypes.CONTEXT
      return ctx[key]
    } else if (
      // global properties
      ((globalProperties = appContext.config.globalProperties),
        hasOwn(globalProperties, key))
    ) {
      return globalProperties[key]
    } else if (
      __DEV__ && currentRenderingInstance &&
      (!isString(key)) ||
      // #1091 避免组件实例的内部isRef/isVNode检查导致无限的警告循环。
      key.indexOf('__v') !== 0
    ) {
      if (data !== EMPTY_OBJ &&
        (key[0] === '$' || key[0] === '_') &&
        hasOwn(data, key)
      ) {
        warn(
          `Property ${JSON.stringify(
            key
          )} must be accessed via $data because it starts with a reserved ` +
          `character ("$" or "_") and is not proxied on the render context.`
        )
      } else {
        warn(
          `Property ${JSON.stringify(key)} was accessed during render ` +
          `but is not defined on instance.`
        )
      }
    }
  }
}

export const RuntimeCompiledPublicInstanceProxyHandlers = extend(
  {},
  PublicInstanceProxyHandlers,
  {
    get(target: ComponentInternalInstance, key: string) {
      // 当使用 "with "块时，不可复制的 ast 路径。
      if ((key as any) === Symbol.unscopables) {
        return
      }
      return PublicInstanceProxyHandlers.get!(target, key, target)
    },
    has(_: ComponentRenderContext, key: string) {
      const has = key[0] !== '_' && !isGloballyWhitelisted(key)
      if (__DEV__ && !has && PublicInstanceProxyHandlers.has!(_, key)) {
        // 禁止 `_` 开头的属性，这是内部保留的前缀
        warn(
          `Property ${JSON.stringify(
            key
          )} should not start with _ which is a reserved prefix for Vue internals.`
        )
      }
      return has
    }
  }
)
