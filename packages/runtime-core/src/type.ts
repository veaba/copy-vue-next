import { ComputedGetter, DebuggerEventExtraInfo, OnCleanup, reactive, Ref, ShallowUnwrapRef, Subscriber, UnwrapNestedRefs, WatchErrorCodes, WatchStopHandle, WritableComputedOptions } from "@vue/reactivity"
import { AllowedComponentProps, App, AppConfig, ClassComponent, ComponentCustomProperties, ComponentCustomProps, ComponentInternalInstance, ComponentOptionsBase, DirectiveBinding, FunctionalComponent, GlobalComponents, GlobalDirectives, InjectionConstraint, LegacyAsyncOptions, LegacyPublicProperties, ObjectDirective, PropOptions, RendererElement, RendererNode, SchedulerJob, SuspenseBoundary, TeleportProps, VNode, WatchEffectOptions } from "./interface"
import { BooleanFlags, DeprecationTypes, ErrorCodes, LifecycleHooks, MoveType } from "./enum"
import {  configureCompat,nextTick, Suspense, SuspenseImpl, Teleport, TeleportImpl } from "."
import { CompilerOptions } from "@vue/compile-core"
import type { OverloadParameters, SlotFlags } from "@vue/shared"
import { COMPONENTS, DIRECTIVES, FILTERS, Fragment, Static } from "./define"

declare const SlotSymbol: unique symbol

export type HydrationStrategy = (
  hydrate: () => void,
  forEachElement: (cb: (el: Element) => any) => void,
) => (() => void) | void

export type AsyncComponentResolveResult<T = Component> = T | { default: T } // es modules

export type AsyncComponentLoader<T = any> = () => Promise<
  AsyncComponentResolveResult<T>
>

/**
 * @deprecated the default `Vue` export has been removed in Vue 3. The type for
 * the default export is provided only for migration purposes. Please use
 * named imports instead - e.g. `import { createApp } from 'vue'`.
 */
export type CompatVue = Pick<App, 'version' | 'component' | 'directive'> & {
  configureCompat: typeof configureCompat

  // no inference here since these types are not meant for actual use - they
  // are merely here to provide type checks for internal implementation and
  // information for migration.
  new(options?: ComponentOptions): LegacyPublicInstance

  version: string
  config: AppConfig & LegacyConfig

  nextTick: typeof nextTick

  use<Options extends unknown[]>(
    plugin: Plugin<Options>,
    ...options: Options
  ): CompatVue
  use<Options>(plugin: Plugin<Options>, options: Options): CompatVue

  mixin(mixin: ComponentOptions): CompatVue

  component(name: string): Component | undefined
  component(name: string, component: Component): CompatVue
  directive<T = any, V = any>(name: string): Directive<T, V> | undefined
  directive<T = any, V = any>(
    name: string,
    directive: Directive<T, V>,
  ): CompatVue

  compile(template: string): RenderFunction

  /**
   * @deprecated Vue 3 no longer supports extending constructors.
   */
  extend: (options?: ComponentOptions) => CompatVue
  /**
   * @deprecated Vue 3 no longer needs set() for adding new properties.
   */
  set(target: any, key: PropertyKey, value: any): void
  /**
   * @deprecated Vue 3 no longer needs delete() for property deletions.
   */
  delete(target: any, key: PropertyKey): void
  /**
   * @deprecated use `reactive` instead.
   */
  observable: typeof reactive
  /**
   * @deprecated filters have been removed from Vue 3.
   */
  filter(name: string, arg?: any): null
  /**
   * @internal
   */
  cid: number
  /**
   * @internal
   */
  options: ComponentOptions
  /**
   * @internal
   */
  util: any
  /**
   * @internal
   */
  super: CompatVue
}


export type WatchOptionItem = string | WatchCallback | ObjectWatchOptionItem
export type ComponentWatchOptionItem = WatchOptionItem | WatchOptionItem[]
export type ComponentWatchOptions = Record<string, ComponentWatchOptionItem>
export type VNodeMountHook = (vnode: VNode) => void
export type VNodeUpdateHook = (vnode: VNode, oldVNode: VNode) => void
export type OptionalKeys<T> = Exclude<keyof T, RequiredKeys<T>>

export type DevtoolsPerformanceHook = (
  component: ComponentInternalInstance,
  type: string,
  time: number,
) => void
export type DeprecationData = {
  message: string | ((...args: any[]) => string)
  link?: string
}
export type UnmountFn = (
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  doRemove?: boolean,
  optimized?: boolean,
) => void
export type RemoveFn = (vnode: VNode) => void
export type MoveFn = (
  vnode: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  type: MoveType,
  parentSuspense?: SuspenseBoundary | null,
) => void

export type PublicPropertiesMap = Record<
  string,
  (i: ComponentInternalInstance) => any
>

export type MountComponentFn = (
  initialVNode: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  namespace: ElementNamespace,
  optimized: boolean,
) => void
export type PatchBlockChildrenFn = (
  oldChildren: VNode[],
  newChildren: VNode[],
  fallbackContainer: RendererElement,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  namespace: ElementNamespace,
  slotScopeIds: string[] | null,
) => void
export type MountChildrenFn = (
  children: VNodeArrayChildren,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  namespace: ElementNamespace,
  slotScopeIds: string[] | null,
  optimized: boolean,
  start?: number,
) => void
export type PatchChildrenFn = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  namespace: ElementNamespace,
  slotScopeIds: string[] | null,
  optimized: boolean,
) => void
export type NextFn = (vnode: VNode) => RendererNode | null


export type LegacyAsyncReturnValue = Promise<Component> | LegacyAsyncOptions
export type LegacyAsyncComponent = (
  resolve?: (res: LegacyAsyncReturnValue) => void,
  reject?: (reason?: any) => void,
) => LegacyAsyncReturnValue | undefined


export type DefaultKeys<T> = {
  [K in keyof T]: T[K] extends
  | { default: any }
  // Boolean implicitly defaults to false
  | BooleanConstructor
  | { type: BooleanConstructor }
  ? T[K] extends { type: BooleanConstructor; required: true } // not default if Boolean is marked as required
  ? never
  : K
  : never
}[keyof T]

export type UnmountChildrenFn = (
  children: VNode[],
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  doRemove?: boolean,
  optimized?: boolean,
  start?: number,
) => void

export type ContextualRenderFn = {
  (...args: any[]): any
  _n: boolean /* already normalized */
  _c: boolean /* compiled */
  _d: boolean /* disableTracking */
  _ns: boolean /* nonScoped */
}

export type VNodeHook =
  | VNodeMountHook
  | VNodeUpdateHook
  | VNodeMountHook[]
  | VNodeUpdateHook[]

/**
 * @internal
 */
export type InternalRenderFunction = {
  (
    ctx: ComponentPublicInstance,
    cache: ComponentInternalInstance['renderCache'],
    // for compiler-optimized bindings
    $props: ComponentInternalInstance['props'],
    $setup: ComponentInternalInstance['setupState'],
    $data: ComponentInternalInstance['data'],
    $options: ComponentInternalInstance['ctx'],
  ): VNodeChild
  _rc?: boolean // isRuntimeCompiled

  // __COMPAT__ only
  _compatChecked?: boolean // v3 and already checked for v2 compat
  _compatWrapped?: boolean // is wrapped for v2 compat
}

// extract props which defined with default from prop options
export type ExtractDefaultPropTypes<O> = O extends object
  ? // use `keyof Pick<O, DefaultKeys<O>>` instead of `DefaultKeys<O>` to support IDE features
  { [K in keyof Pick<O, DefaultKeys<O>>]: InferPropType<O[K]> }
  : {}

export type RequiredKeys<T> = {
  [K in keyof T]: T[K] extends
  | { required: true }
  | { default: any }
  // don't mark Boolean props as undefined
  | BooleanConstructor
  | { type: BooleanConstructor }
  ? T[K] extends { default: undefined | (() => undefined) }
  ? never
  : K
  : never
}[keyof T]

/**
 * Extract prop types from a runtime props options object.
 * The extracted types are **internal** - i.e. the resolved props received by
 * the component.
 * - Boolean props are always present
 * - Props with default values are always present
 *
 * To extract accepted props from the parent, use {@link ExtractPublicPropTypes}.
 */
export type ExtractPropTypes<O> = {
  // use `keyof Pick<O, RequiredKeys<O>>` instead of `RequiredKeys<O>` to
  // support IDE features
  [K in keyof Pick<O, RequiredKeys<O>>]: O[K] extends { default: any }
  ? Exclude<InferPropType<O[K]>, undefined>
  : InferPropType<O[K]>
} & {
  // use `keyof Pick<O, OptionalKeys<O>>` instead of `OptionalKeys<O>` to
  // support IDE features
  [K in keyof Pick<O, OptionalKeys<O>>]?: InferPropType<O[K]>
}

export type InferPropType<T, NullAsAny = true> = [T] extends [null]
  ? NullAsAny extends true
  ? any
  : null
  : [T] extends [{ type: null | true }]
  ? any // As TS issue https://github.com/Microsoft/TypeScript/issues/14829 // somehow `ObjectConstructor` when inferred from { (): T } becomes `any` // `BooleanConstructor` when inferred from PropConstructor(with PropMethod) becomes `Boolean`
  : [T] extends [ObjectConstructor | { type: ObjectConstructor }]
  ? Record<string, any>
  : [T] extends [BooleanConstructor | { type: BooleanConstructor }]
  ? boolean
  : [T] extends [DateConstructor | { type: DateConstructor }]
  ? Date
  : [T] extends [(infer U)[] | { type: (infer U)[] }]
  ? U extends DateConstructor
  ? Date | InferPropType<U, false>
  : InferPropType<U, false>
  : [T] extends [Prop<infer V, infer D>]
  ? unknown extends V
  ? keyof V extends never
  ? IfAny<V, V, D>
  : V
  : V
  : T

export type ResolveProps<PropsOrPropOptions, E extends EmitsOptions> = Readonly<
  PropsOrPropOptions extends ComponentPropsOptions
  ? ExtractPropTypes<PropsOrPropOptions>
  : PropsOrPropOptions
> &
  ({} extends E ? {} : EmitsToProps<E>)

export type VNodeNormalizedRefAtom = {
  /**
   * component instance
   */
  i: ComponentInternalInstance
  /**
   * Actual ref
   */
  r: VNodeRef
  /**
   * setup ref key
   */
  k?: string
  /**
   * refInFor marker
   */
  f?: boolean
}
export type ComponentObjectPropsOptions<P = Data> = {
  [K in keyof P]: Prop<P[K]> | null
}


export type Data = Record<string, unknown>
export type MergedComponentOptions = ComponentOptions &
  MergedComponentOptionsOverride
export type ObjectProvideOptions = Record<string | symbol, unknown>
export type DefaultFactory<T> = (props: Data) => T | null | undefined
export type MergedHook<T = () => void> = T | T[]
export type Hook<T = () => void> = T | T[]
export type CountMap = Map<SchedulerJob, number>
export type DevtoolsComponentHook = (component: ComponentInternalInstance) => void
export type HMRComponent = ComponentOptions | ClassComponent
export type SetRootFn = ((root: VNode) => void) | undefined

export type InjectionKey<T> = symbol & InjectionConstraint<T>
export type VNodeChild = VNodeChildAtom | VNodeArrayChildren
export type NormalizedStyle = Record<string, string | number>
export type ComponentProvideOptions = ObjectProvideOptions | Function
export type LifecycleHook<TFn = Function> = (TFn & SchedulerJob)[] | null
export type ElementNamespace = 'svg' | 'mathml' | undefined
export type ComponentInjectOptions = string[] | ObjectInjectOptions
export type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N
export type Slots = Readonly<InternalSlots>
export type VNodeArrayChildren = Array<VNodeArrayChildren | VNodeChildAtom>
export type OptionMergeFunction = (to: unknown, from: unknown) => any
export type ComponentTypeEmits = ((...args: any[]) => any) | Record<string, any>
export type EmitsOptions = ObjectEmitsOptions | string[]
export type OptionTypesKeys = 'P' | 'B' | 'D' | 'C' | 'M' | 'Defaults'
export type NormalizedPropsOptions = [NormalizedProps, string[]] | []
export type NormalizedProps = Record<string, NormalizedProp>
export type PropType<T> = PropConstructor<T> | (PropConstructor<T> | null)[]
export type Prop<T, D = T> = PropOptions<T, D> | PropType<T>
export type TeleportVNode = VNode<RendererNode, RendererElement, TeleportProps>
export type LooseRequired<T> = { [P in keyof (T & Required<T>)]: T[P] }
export type RenderFunction = () => VNodeChild
export type SchedulerJobs = SchedulerJob | SchedulerJob[]
export type ErrorTypes = LifecycleHooks | ErrorCodes | WatchErrorCodes

export type AssetTypes = typeof COMPONENTS | typeof DIRECTIVES | typeof FILTERS

export type LegacyVNodeChildren =
  | string
  | number
  | boolean
  | VNode
  | VNodeArrayChildren

export type AssertionResult = {
  valid: boolean
  expectedType: string
}

export type CreateHook<T = any> = (
  hook: T,
  target?: ComponentInternalInstance | null,
) => void

// legacy config warnings
export type LegacyConfig = {
  /**
   * @deprecated `config.silent` option has been removed
   */
  silent?: boolean
  /**
   * @deprecated use __VUE_PROD_DEVTOOLS__ compile-time feature flag instead
   * https://github.com/vuejs/core/tree/main/packages/vue#bundler-build-feature-flags
   */
  devtools?: boolean
  /**
   * @deprecated use `config.isCustomElement` instead
   * https://v3-migration.vuejs.org/breaking-changes/global-api.html#config-ignoredelements-is-now-config-iscustomelement
   */
  ignoredElements?: (string | RegExp)[]
  /**
   * @deprecated
   * https://v3-migration.vuejs.org/breaking-changes/keycode-modifiers.html
   */
  keyCodes?: Record<string, number | number[]>
  /**
   * @deprecated
   * https://v3-migration.vuejs.org/breaking-changes/global-api.html#config-productiontip-removed
   */
  productionTip?: boolean
}

export type DefineSetupFnComponent<
  P extends Record<string, any>,
  E extends EmitsOptions = {},
  S extends SlotsType = SlotsType,
  Props = P & EmitsToProps<E>,
  PP = PublicProps,
> = new (
  props: Props & PP,
) => CreateComponentPublicInstanceWithMixins<
  Props,
  {},
  {},
  {},
  {},
  ComponentOptionsMixin,
  ComponentOptionsMixin,
  E,
  PP,
  {},
  false,
  {},
  S
>

export type IsKeyValues<T, K = string> = IfAny<
  T,
  false,
  T extends object ? (keyof T extends K ? true : false) : false
>

export type ToResolvedProps<Props, Emits extends EmitsOptions> = Readonly<Props> &
  Readonly<EmitsToProps<Emits>>

export type IsStringLiteral<T> = T extends string
  ? string extends T
    ? false
    : true
  : false

export type ParametersToFns<T extends any[]> = {
  [K in T[0]]: IsStringLiteral<K> extends true
    ? (
        ...args: T extends [e: infer E, ...args: infer P]
          ? K extends E
            ? P
            : never
          : never
      ) => any
    : never
}  

export type TypeEmitsToOptions<T extends ComponentTypeEmits> = {
  [K in keyof T & string]: T[K] extends [...args: infer Args]
    ? (...args: Args) => any
    : () => any
} & (T extends (...args: any[]) => any
  ? ParametersToFns<OverloadParameters<T>>
  : {})


export type LegacyPublicInstance = ComponentPublicInstance &
  LegacyPublicProperties


  
  export type ComponentPropsOptions<P = Data> =
    | ComponentObjectPropsOptions<P>
    | string[]
  
  export type VNodeNormalizedRef =
    | VNodeNormalizedRefAtom
    | VNodeNormalizedRefAtom[]
  
  export type PluginInstallFunction<Options = any[]> = Options extends unknown[]
    ? (app: App, ...options: Options) => any
    : (app: App, options: Options) => any
  export type NormalizedProp = PropOptions & {
    [BooleanFlags.shouldCast]?: boolean
    [BooleanFlags.shouldCastTrue]?: boolean
  }
  export type PropConstructor<T = any> =
    | { new(...args: any[]): T & {} }
    | { (): T }
    | PropMethod<T>
  export type PropMethod<T, TConstructor = any> = [T] extends [
    ((...args: any) => any) | undefined,
  ] // if is function with args, allowing non-required functions
    ? { new(): TConstructor; (): T; readonly prototype: TConstructor } // Create Function like constructor
    : never
  
  export type ProcessTextOrCommentFn = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
  ) => void
  export type ObjectPlugin<Options = any[]> = {
    install: PluginInstallFunction<Options>
  }
  export type VNodeTypes =
    | string
    | VNode
    | Component
    | typeof Text
    | typeof Static
    | typeof Comment
    | typeof Fragment
    | typeof Teleport
    | typeof TeleportImpl
    | typeof Suspense
    | typeof SuspenseImpl
  


export type VNodeRef =
  | string
  | Ref
  | ((
    ref: Element | ComponentPublicInstance | null,
    refs: Record<string, any>,
  ) => void)

export type EmitsToProps<T extends EmitsOptions | ComponentTypeEmits> =
  T extends string[]
  ? {
    [K in `on${Capitalize<T[number]>}`]?: (...args: any[]) => any
  }
  : T extends ObjectEmitsOptions
  ? {
    [K in string & keyof T as `on${Capitalize<K>}`]?: (
      ...args: T[K] extends (...args: infer P) => any
        ? P
        : T[K] extends null
        ? any[]
        : never
    ) => any
  }
  : {}

export type VNodeProps = {
  key?: PropertyKey
  ref?: VNodeRef
  ref_for?: boolean
  ref_key?: string

  // vnode hooks
  onVnodeBeforeMount?: VNodeMountHook | VNodeMountHook[]
  onVnodeMounted?: VNodeMountHook | VNodeMountHook[]
  onVnodeBeforeUpdate?: VNodeUpdateHook | VNodeUpdateHook[]
  onVnodeUpdated?: VNodeUpdateHook | VNodeUpdateHook[]
  onVnodeBeforeUnmount?: VNodeMountHook | VNodeMountHook[]
  onVnodeUnmounted?: VNodeMountHook | VNodeMountHook[]
}
export type FunctionPlugin<Options = any[]> = PluginInstallFunction<Options> &
  Partial<ObjectPlugin<Options>>

export type Plugin<
  Options = any[],
  // TODO: in next major Options extends unknown[] and remove P
  P extends unknown[] = Options extends unknown[] ? Options : [Options],
> = FunctionPlugin<P> | ObjectPlugin<P>

export type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onCleanup: OnCleanup
) => any
export type VNodeChildAtom =
  | VNode
  | string
  | number
  | boolean
  | null
  | undefined
  | void
export interface WatchOptions<Immediate = boolean> extends WatchEffectOptions {
  immediate?: Immediate
  deep?: boolean | number
  once?: boolean
}

export type ObjectWatchOptionItem = {
  handler: WatchCallback | string
} & WatchOptions

export type RawSlots = {
  [name: string]: unknown
  // manual render fn hint to skip forced children updates
  $stable?: boolean
  /**
   * for tracking slot owner instance. This is attached during
   * normalizeChildren when the component vnode is created.
   * @internal
   */
  _ctx?: ComponentInternalInstance | null
  /**
   * indicates compiler generated slots
   * we use a reserved property instead of a vnode patchFlag because the slots
   * object may be directly passed down to a child component in a manual
   * render function, and the optimization hint need to be on the slot object
   * itself to be preserved.
   * @internal
   */
  _?: SlotFlags
}
export type VNodeNormalizedChildren =
  | string
  | VNodeArrayChildren
  | RawSlots
  | null

// use `E extends any` to force evaluating type to fix #2362
export type SetupContext<
  E = EmitsOptions,
  S extends SlotsType = {},
> = E extends any
  ? {
    attrs: Data
    slots: UnwrapSlotsType<S>
    emit: EmitFn<E>
    expose: <Exposed extends Record<string, any> = Record<string, any>>(
      exposed?: Exposed,
    ) => void
  }
  : never

export type CreateAppFunction<HostElement> = (
  rootComponent: Component,
  rootProps?: Data | null,
) => App<HostElement>


export type CompatConfig = Partial<
  Record<DeprecationTypes, boolean | 'suppress-warning'>
> & {
  MODE?: 2 | 3 | ((comp: Component | null) => 2 | 3)
}
export type ExposedKeys<
  T,
  Exposed extends string & keyof T
> = '' extends Exposed ? T : Pick<T, Exposed>

export type InternalSlots = {
  [name: string]: Slot | undefined
}
export type SlotsType<T extends Record<string, any> = Record<string, any>> = {
  [SlotSymbol]?: T
}
export type ObjectInjectOptions = Record<
  string | symbol,
  string | symbol | { from?: string | symbol; default?: unknown }
>
export type Slot<T extends any = any> = (
  ...args: IfAny<T, any[], [T] | (T extends undefined ? [] : never)>
) => VNode[]

export type UnionToIntersection<U> = (U extends any
  ? (k: U) => void
  : never) extends (k: infer I) => void
  ? I
  : never

export type EmitFn<
  Options = ObjectEmitsOptions,
  Event extends keyof Options = keyof Options
> = Options extends Array<infer V>
  ? (event: V, ...args: any[]) => void
  : {} extends Options // if the emit is empty object (usually the default value for emit) should be converted to function
  ? (event: string, ...args: any[]) => void
  : UnionToIntersection<
    {
      [key in Event]: Options[key] extends (...args: infer Args) => any
      ? (event: key, ...args: Args) => void
      : Options[key] extends any[]
      ? (event: key, ...args: Options[key]) => void
      : (event: key, ...args: any[]) => void
    }[Event]
  >

export type RootRenderFunction<HostElement = RendererElement> = (
  vnode: VNode | null,
  container: HostElement,
  namespace?: ElementNamespace
) => void

export type PatchFn = (
  n1: VNode | null, // null means this is a mount
  n2: VNode,
  container: RendererElement,
  anchor?: RendererNode | null,
  parentComponent?: ComponentInternalInstance | null,
  parentSuspense?: SuspenseBoundary | null,
  namespace?: ElementNamespace,
  slotScopeIds?: string[] | null,
  optimized?: boolean
) => void

export type RootHydrateFunction = (
  vnode: VNode<Node, Element>,
  container: (Element | ShadowRoot) & { _vnode?: VNode }
) => void

/**
 * Concrete component type matches its actual value: it's either an options
 * object, or a function. Use this where the code expects to work with actual
 * values, e.g. checking if its a function or not. This is mostly for internal
 * implementation code.
 */
export type ConcreteComponent<
  Props = {},
  RawBindings = any,
  D = any,
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions,
  E extends EmitsOptions | Record<string, any[]> = {},
  S extends Record<string, any> = any
> =
  | ComponentOptions<Props, RawBindings, D, C, M>
  | FunctionalComponent<Props, E, S>

export type SetupRenderEffectFn = (
  instance: ComponentInternalInstance,
  initialVNode: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentSuspense: SuspenseBoundary | null,
  namespace: ElementNamespace,
  optimized: boolean
) => void

export type DebuggerEvent = {
  effect: Subscriber
} & DebuggerEventExtraInfo

export type DebuggerHook = (e: DebuggerEvent) => void
export type ErrorCapturedHook<TError = unknown> = (
  err: TError,
  instance: ComponentPublicInstance | null,
  info: string
) => boolean | void
export type MergedComponentOptionsOverride = {
  beforeCreate?: MergedHook
  created?: MergedHook
  beforeMount?: MergedHook
  mounted?: MergedHook
  beforeUpdate?: MergedHook
  updated?: MergedHook
  activated?: MergedHook
  deactivated?: MergedHook
  /** @deprecated use `beforeUnmount` instead */
  beforeDestroy?: MergedHook
  beforeUnmount?: MergedHook
  /** @deprecated use `unmounted` instead */
  destroyed?: MergedHook
  unmounted?: MergedHook
  renderTracked?: MergedHook<DebuggerHook>
  renderTriggered?: MergedHook<DebuggerHook>
  errorCaptured?: MergedHook<ErrorCapturedHook>
}

export type Prettify<T> = { [K in keyof T]: T[K] } & {}

export type ExtractComputedReturns<T extends any> = {
  [key in keyof T]: T[key] extends { get: (...args: any[]) => infer TReturn }
  ? TReturn
  : T[key] extends (...args: any[]) => infer TReturn
  ? TReturn
  : never
}

export type UnwrapSlotsType<
  S extends SlotsType,
  T = NonNullable<S[typeof SlotSymbol]>
> = [keyof S] extends [never]
  ? Slots
  : Readonly<
    Prettify<
      {
        [K in keyof T]: NonNullable<T[K]> extends (...args: any[]) => any
        ? T[K]
        : Slot<T[K]>
      }
    >
  >

// public properties exposed on the proxy, which is used as the render context
// in templates (as `this` in the render option)
export type ComponentPublicInstance<
  P = {}, // props type extracted from props option
  B = {}, // raw bindings returned from setup()
  D = {}, // return from data()
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  E extends EmitsOptions = {},
  PublicProps = {},
  Defaults = {},
  MakeDefaultsOptional extends boolean = false,
  Options = ComponentOptionsBase<any, any, any, any, any, any, any, any, any>,
  I extends ComponentInjectOptions = {},
  S extends SlotsType = {},
  Exposed extends string = '',
  TypeRefs extends Data = {},
  TypeEl extends Element = any
> = {
  $: ComponentInternalInstance
  $data: D
  $props: MakeDefaultsOptional extends true
  ? Partial<Defaults> & Omit<Prettify<P> & PublicProps, keyof Defaults>
  : Prettify<P> & PublicProps
  $attrs: Data
  $refs: Data & TypeRefs
  $slots: UnwrapSlotsType<S>
  $root: ComponentPublicInstance | null
  $parent: ComponentPublicInstance | null
  $host: Element | null
  $emit: EmitFn<E>
  $el: TypeEl
  $options: Options & MergedComponentOptionsOverride
  $forceUpdate: () => void
  $nextTick: typeof nextTick
  $watch<T extends string | ((...args: any) => any)>(
    source: T,
    cb: T extends (...args: any) => infer R
      ? (...args: [R, R, OnCleanup]) => any
      : (...args: [any, any, OnCleanup]) => any,
    options?: WatchOptions
  ): WatchStopHandle
} & ExposedKeys<
  IfAny<
    P,
    P,
    Readonly<Defaults> & Omit<P, keyof ShallowUnwrapRef<B> | keyof Defaults>
  > &
  ShallowUnwrapRef<B> &
  UnwrapNestedRefs<D> &
  ExtractComputedReturns<C> &
  M &
  ComponentCustomProperties &
  InjectToObject<I>,
  Exposed
>

export type EnsureNonVoid<T> = T extends void ? {} : T

export type UnwrapMixinsType<
  T,
  Type extends OptionTypesKeys
> = T extends OptionTypesType ? T[Type] : never

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

export type IsDefaultMixinComponent<T> = T extends ComponentOptionsMixin
  ? ComponentOptionsMixin extends T
  ? true
  : false
  : false

export type ExtractMixin<T> = {
  Mixin: MixinToOptionTypes<T>
}[T extends ComponentOptionsMixin ? 'Mixin' : never]

export type IntersectionMixin<T> = IsDefaultMixinComponent<T> extends true
  ? OptionTypesType
  : UnionToIntersection<ExtractMixin<T>>

export type MixinToOptionTypes<T> = T extends ComponentOptionsBase<
  infer P,
  infer B,
  infer D,
  infer C,
  infer M,
  infer Mixin,
  infer Extends,
  any,
  any,
  infer Defaults,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>
  ? OptionTypesType<P & {}, B & {}, D & {}, C & {}, M & {}, Defaults & {}> &
  IntersectionMixin<Mixin> &
  IntersectionMixin<Extends>
  : never

export type MatchPattern = string | RegExp | (string | RegExp)[]

/**
 * This is the same as `CreateComponentPublicInstance` but adds local components,
 * global directives, exposed, and provide inference.
 * It changes the arguments order so that we don't need to repeat mixin
 * inference everywhere internally, but it has to be a new type to avoid
 * breaking types that relies on previous arguments order (#10842)
 */
export type CreateComponentPublicInstanceWithMixins<
  P = {},
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
  I extends ComponentInjectOptions = {},
  S extends SlotsType = {},
  LC extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string,
  TypeRefs extends Data = {},
  TypeEl extends Element = any,
  Provide extends ComponentProvideOptions = ComponentProvideOptions,
  // mixin inference
  PublicMixin = IntersectionMixin<Mixin> & IntersectionMixin<Extends>,
  PublicP = UnwrapMixinsType<PublicMixin, 'P'> & EnsureNonVoid<P>,
  PublicB = UnwrapMixinsType<PublicMixin, 'B'> & EnsureNonVoid<B>,
  PublicD = UnwrapMixinsType<PublicMixin, 'D'> & EnsureNonVoid<D>,
  PublicC extends ComputedOptions = UnwrapMixinsType<PublicMixin, 'C'> &
  EnsureNonVoid<C>,
  PublicM extends MethodOptions = UnwrapMixinsType<PublicMixin, 'M'> &
  EnsureNonVoid<M>,
  PublicDefaults = UnwrapMixinsType<PublicMixin, 'Defaults'> &
  EnsureNonVoid<Defaults>
> = ComponentPublicInstance<
  PublicP,
  PublicB,
  PublicD,
  PublicC,
  PublicM,
  E,
  PublicProps,
  PublicDefaults,
  MakeDefaultsOptional,
  ComponentOptionsBase<
    P,
    B,
    D,
    C,
    M,
    Mixin,
    Extends,
    E,
    string,
    Defaults,
    {},
    string,
    S,
    LC,
    Directives,
    Exposed,
    Provide
  >,
  I,
  S,
  Exposed,
  TypeRefs,
  TypeEl
>

export type ComponentOptions<
  Props = {},
  RawBindings = any,
  D = any,
  C extends ComputedOptions = any,
  M extends MethodOptions = any,
  Mixin extends ComponentOptionsMixin = any,
  Extends extends ComponentOptionsMixin = any,
  E extends EmitsOptions = any,
  EE extends string = string,
  Defaults = {},
  I extends ComponentInjectOptions = {},
  II extends string = string,
  S extends SlotsType = {},
  LC extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string,
  Provide extends ComponentProvideOptions = ComponentProvideOptions
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
  Defaults,
  I,
  II,
  S,
  LC,
  Directives,
  Exposed,
  Provide
> &
  ThisType<
    CreateComponentPublicInstanceWithMixins<
      {},
      RawBindings,
      D,
      C,
      M,
      Mixin,
      Extends,
      E,
      Readonly<Props>,
      Defaults,
      false,
      I,
      S,
      LC,
      Directives
    >
  >

export type InjectToObject<
  T extends ComponentInjectOptions
> = T extends string[]
  ? {
    [K in T[number]]?: unknown
  }
  : T extends ObjectInjectOptions
  ? {
    [K in keyof T]?: unknown
  }
  : never

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
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>

export type DirectiveModifiers<K extends string = string> = Partial<
  Record<K, boolean>
>
export type ShortEmitsToObject<E> = E extends Record<string, any[]>
  ? {
    [K in keyof E]: (...args: E[K]) => any
  }
  : E

export type SSRDirectiveHook<
  Value = any,
  Modifiers extends string = string,
  Arg extends string = string
> = (
  binding: DirectiveBinding<Value, Modifiers, Arg>,
  vnode: VNode
) => Data | undefined

export type FunctionDirective<
  HostElement = any,
  V = any,
  Modifiers extends string = string,
  Arg extends string = string
> = DirectiveHook<HostElement, any, V, Modifiers, Arg>

export type DirectiveHook<
  HostElement = any,
  Prev = VNode<any, HostElement> | null,
  Value = any,
  Modifiers extends string = string,
  Arg extends string = string
> = (
  el: HostElement,
  binding: DirectiveBinding<Value, Modifiers, Arg>,
  vnode: VNode<any, HostElement>,
  prevVNode: Prev
) => void
export type Directive<
  HostElement = any,
  Value = any,
  Modifiers extends string = string,
  Arg extends string = string
> =
  | ObjectDirective<HostElement, Value, Modifiers, Arg>
  | FunctionDirective<HostElement, Value, Modifiers, Arg>

export type Component<
  PropsOrInstance = any,
  RawBindings = any,
  D = any,
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions,
  E extends EmitsOptions | Record<string, any[]> = {},
  S extends Record<string, any> = any
> =
  | ConcreteComponent<PropsOrInstance, RawBindings, D, C, M, E, S>
  | ComponentPublicInstanceConstructor<PropsOrInstance>

export interface ComponentCustomElementInterface {
  /**
   * @internal
   */
  _injectChildStyle(type: ConcreteComponent): void
  /**
   * @internal
   */
  _removeChildStyle(type: ConcreteComponent): void
  /**
   * @internal
   */
  _setProp(
    key: string,
    val: any,
    shouldReflect?: boolean,
    shouldUpdate?: boolean,
  ): void
  /**
   * @internal attached by the nested Teleport when shadowRoot is false.
   */
  _teleportTarget?: RendererElement
}

export type ComponentPublicInstanceConstructor<
  T extends ComponentPublicInstance<
    Props,
    RawBindings,
    D,
    C,
    M
  > = ComponentPublicInstance<any>,
  Props = any,
  RawBindings = any,
  D = any,
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions
> = {
  __isFragment?: never
  __isTeleport?: never
  __isSuspense?: never
  new(...args: any[]): T
}
export type ObjectEmitsOptions = Record<
  string,
  ((...args: any[]) => any) | null
>
export type ComputedOptions = Record<
  string,
  ComputedGetter<any> | WritableComputedOptions<any>
>
export interface MethodOptions {
  [key: string]: Function
}
export type PublicProps = VNodeProps &
  AllowedComponentProps &
  ComponentCustomProps

export type DefineComponent<
  PropsOrPropOptions = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions,
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = {},
  EE extends string = string,
  PP = PublicProps,
  Props = ResolveProps<PropsOrPropOptions, E>,
  Defaults = ExtractDefaultPropTypes<PropsOrPropOptions>,
  S extends SlotsType = {},
  LC extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string,
  Provide extends ComponentProvideOptions = ComponentProvideOptions,
  MakeDefaultsOptional extends boolean = true,
  TypeRefs extends Record<string, unknown> = {},
  TypeEl extends Element = any,
> = ComponentPublicInstanceConstructor<
  CreateComponentPublicInstanceWithMixins<
    Props,
    RawBindings,
    D,
    C,
    M,
    Mixin,
    Extends,
    E,
    PP,
    Defaults,
    MakeDefaultsOptional,
    {},
    S,
    LC & GlobalComponents,
    Directives & GlobalDirectives,
    Exposed,
    TypeRefs,
    TypeEl
  >
> &
  ComponentOptionsBase<
    Props,
    RawBindings,
    D,
    C,
    M,
    Mixin,
    Extends,
    E,
    EE,
    Defaults,
    {},
    string,
    S,
    LC & GlobalComponents,
    Directives & GlobalDirectives,
    Exposed,
    Provide
  > &
  PP


export type CompileFunction = (
  template: string | object,
  options?: CompilerOptions,
) => InternalRenderFunction


// Directive, value, argument, modifiers
export type DirectiveArguments = Array<
  | [Directive | undefined]
  | [Directive | undefined, any]
  | [Directive | undefined, any, string]
  | [Directive | undefined, any, string | undefined, DirectiveModifiers]
>


export type RawChildren =
  | string
  | number
  | boolean
  | VNode
  | VNodeArrayChildren
  | (() => any)

  export type RawProps = VNodeProps & {
  // used to differ from a single VNode object as children
  __v_isVNode?: never
  // used to differ from Array children
  [Symbol.iterator]?: never
} & Record<string, any>


export type HTMLElementEventHandler = {
  [K in keyof HTMLElementEventMap as `on${Capitalize<K>}`]?: (
    ev: HTMLElementEventMap[K],
  ) => any
}


// fake constructor type returned from `defineComponent`
export interface Constructor<P = any> {
  __isFragment?: never
  __isTeleport?: never
  __isSuspense?: never
  new (...args: any[]): { $props: P }
}