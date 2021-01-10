/**
 * @bug webstorm 似乎存在 format 的错误
 * - resolveMergedOptions
 * */
import { ComputedGetter, WritableComputedOptions } from '@vue/reactivity'
import {
  Component,
  ComponentInternalInstance,
  ComponentInternalOptions,
  ConcreteComponent,
  Data,
  SetupContext
} from './component'
import { EmitsOptions } from './componentEmits'
import { CreateComponentPublicInstance } from './componentPublicInstance'
import { Directive } from './directives'
import { WatchCallback, WatchOptions } from './apiWatch'
import { DebuggerHook, ErrorCapturedHook } from './apiLifecycle'
import { VNodeChild } from './vnode'
import { hasOwn } from '@vue/shared'

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
export interface ComponentCustomOptions {
}

export type RenderFunction = () => VNodeChild;

export interface ComponentOptionsBase<Props,
  RawBindings,
  D,
  C extends ComputedOptions,
  M extends MethodOptions,
  Mixin extends ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin,
  E extends EmitsOptions,
  EE extends string = string,
  Defaults = {}> extends LegacyOptions<Props, D, C, M, Mixin, Extends>,
  ComponentInternalOptions,
  ComponentCustomOptions {
  setup?: (
    this: void,
    props: Props,
    ctx: SetupContext<E, Props>
  ) => Promise<RawBindings> | RawBindings | RenderFunction | void;
  name?: string;
  template?: string | object; // 可以是直接 DOM
  // Note: we are intentionally using the signature-less `Function` type here
  // since any type with signature will cause the whole inference to fail when
  // the return expression contains reference to `this`.
  // Luckily `render()` doesn't need any arguments nor does it care about return
  // type.
  render?: Function;
  components: Record<string, Component>;
  directives?: Record<string, Directive>;
  inheritAttrs?: boolean;
  emits?: (E | EE[]) & ThisType<void>;
  //  根据暴露的密钥来推断公共实例类型
  expose?: string[];

  serverPrefetch?(): Promise<any>;

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
  ) => void;

  /**
   * 仅由 compile-sfc生成，用于标记一个内联的 ssr 渲染函数，并从setup()返回。
   * @internal
   * */
  __ssrInlineRender?: boolean;
  /**
   * AsyncComponentWrapper 标记
   * @internal
   * */
  __asyncLoader?: () => Promise<ConcreteComponent>;
  /**
   * cache for merged $options
   * @internal
   */
  __merged?: ComponentOptions;
  // Type 声明 -----------------------------------------
  // 请注意，这些都是内部的，但需要在d.ts中暴露出来，以便进行类型推理。

  // 纯类型区分符，将 OptionWithoutProps 与 defineComponent() 或 FunctionalComponent 返回的构造函数类型分开。
  call?: (this: unknown, ...args: unknown[]) => never;
  // 内建Vnode类型的类型区分器。
  __isFragment?: never;
  __isTeleport?: never;
  __isSuspense?: never;

  __defaults?: Defaults;
}

export type ComponentOptionsWithoutProps<Props = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = EmitsOptions,
  EE extends string = string> = ComponentOptionsBase<Props,
  RawBindings,
  D,
  C,
  M,
  Mixin,
  Extends,
  E,
  EE,
  {}> & {
  props?: undefined;
} & ThisType<CreateComponentPublicInstance<{}, RawBindings, D, C, M, Mixin, Extends, E>>;

export type ComponentOptionsWithArrayProps<PropNames extends string = string,
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = EmitsOptions,
  EE extends string = string,
  Props = Readonly<{ [key in PropNames]?: any }>> = ComponentOptionsBase<Props,
  RawBindings,
  D,
  C,
  M,
  Mixin,
  Extends,
  E,
  EE,
  {}> & {
  props: PropNames[];
} & ThisType<CreateComponentPublicInstance<Props,
  RawBindings,
  D,
  C,
  M,
  Mixin,
  Extends,
  E>>;
export type ComponentOptions<Props = {},
  RawBindings = any,
  D = any,
  C extends ComputedOptions = any,
  M extends MethodOptions = any,
  Mixin extends ComponentOptionsMixin = any,
  Extends extends ComponentOptionsMixin = any,
  E extends EmitsOptions = any> = ComponentOptionsBase<Props, RawBindings, D, C, M, Mixin, Extends, E> &
  ThisType<CreateComponentPublicInstance<{},
    RawBindings,
    D,
    C,
    M,
    Mixin,
    Extends,
    E,
    Readonly<Props>>>;

export type ComponentOptionsMixin = ComponentOptionsBase<any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any>;

export type ComputedOptions = Record<string,
  ComputedGetter<any> | WritableComputedOptions<any>>;

export interface MethodOptions {
  [key: string]: Function;
}

export type ExtractComputedReturns<T extends any> = {
  [key in keyof T]: T[key] extends { get: (...args: any[]) => infer TReturn }
    ? TReturn
    : T[key] extends (...args: any[]) => infer TReturn
      ? TReturn
      : never;
};

type WatchOptionItem =
  | string
  | WatchCallback
  | ({ handler: WatchCallback | string } & WatchOptions);
type ComponentWatchOptionItem = WatchOptionItem | WatchOptionItem[];
type ComponentWatchOptions = Record<string, ComponentWatchOptionItem>;

type ComponentInjectOptions =
  | string[]
  | Record<string | symbol,
  string | symbol | { from?: string | symbol; default?: unknown }>;

interface LegacyOptions<Props,
  D,
  C extends ComputedOptions,
  M extends MethodOptions,
  Mixin extends ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin> {
  // 允许任何自定义选项
  [key: string]: any;

  // state
  // 限制：我们不能在 data 的 `this` 上下文上暴露 RawBindings，因为这会导致某种循环推断，并破坏整个组件的ThisType。
  data?: (
    this: CreateComponentPublicInstance<Props>,
    vm: CreateComponentPublicInstance<Props>
  ) => D;
  computed?: C;
  methods?: M;
  watch?: ComponentWatchOptions;
  provide?: Data | Function;
  inject?: ComponentInjectOptions;

  // composition
  mixins?: Mixin[];
  extends?: Extends;

  // lifecycle

  beforeCreate?(): void;

  created?(): void;

  beforeMount?(): void;

  mounted?(): void;

  beforeUpdate?(): void;

  updated?(): void;

  beforeUnmount?(): void;

  unmounted?(): void;

  activated?(): void;

  deactivated?(): void;

  /** @deprecated 使用 `beforeUnmount` 替代，不久的将来移除 */
  beforeDestroy?(): void;

  /** @deprecated 使用 `unmounted` 替代，不久的将来移除 */
  destroyed?(): void;

  renderTracked?: DebuggerHook;
  renderTriggered?: DebuggerHook;
  errorCaptured?: ErrorCapturedHook;

  // 仅用于runtime compile
  delimiters?: ErrorCapturedHook;
}

export type OptionTypesKeys = 'P' | 'B' | 'D' | 'C' | 'M' | 'Defaults';

export type OptionTypesType<P = {},
  B = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Defaults = {}> = {
  P: P;
  B: B;
  D: D;
  C: C;
  M: M;
  Defaults: Defaults;
};

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
  globalMixins.forEach((m) => mergeOptions(options, m, instance))
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
