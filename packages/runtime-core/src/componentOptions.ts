import {ComputedGetter, WritableComputedOptions} from "@vue/reactivity";
import {
    Component, ComponentInternalInstance,
    ComponentInternalOptions,
    Data
} from "./component";
import {PropOptions, PropType} from "./componentProps";
import {EmitsOptions} from "./componentEmits";
import {CreateComponentPublicInstance} from "./componentPublicInstance";
import {Directive} from "./directive";
import {WatchCallback} from "./apiWatch";
import {DebuggerHook, ErrorCapturedHook} from "./apiLifecycle";
import {VNodeChild} from "./vnode";
import {hasOwn} from "@vue/shared";


type WatchOptionsItem = | string | WatchCallback | { handler: WatchCallback | string } & WatchOptionsItem[]
type ComponentWatchOptionsItem = WatchOptionsItem | WatchOptionsItem[]
type ComponentWatchOptions = Record<string, ComponentWatchOptionsItem>

type ComponentInjectOptions =
    | string[]
    | Record<string | symbol, string | symbol | { from?: string | symbol; default?: unknown }>

export interface MethodOptions {
    [key: string]: Function
}

export enum BooleanFlags {
    shouldCast = 0,
    shouldCastTrue = 1
}


export type Prop<T, D = T> = PropOptions<T, D> | PropType<T>
export type ComponentObjectPropsOptions<P = Data> = {
    [K in keyof P]: Prop<P[K]> | null
}

export type ComponentPropsOptions<P = Data> = | ComponentObjectPropsOptions<P> | string[]

export type ComputedOptions = Record<string, ComputedGetter<any> | WritableComputedOptions<any>>

export type ComponentOptionsMixin = ComponentOptionsBase<any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any>

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

export type  RenderFunction = () => VNodeChild

interface LegacyOptions<Props,
    D,
    C extends ComputedOptions,
    M extends MethodOptions,
    Mixin extends ComponentOptionsMixin,
    Extends extends ComponentOptionsMixin> {
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
    mixins?: Mixin[],
    extends?: Extends,

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
    delimiters?: ErrorCapturedHook
}

export interface ComponentOptionsBase<Props,
    RawBindings,
    D,
    C extends ComputedOptions,
    M extends MethodOptions,
    Mixin extends ComponentOptionsMixin,
    Extends extends ComponentOptionsMixin,
    E extends EmitsOptions,
    EE extends string = string,
    Default = {}> extends LegacyOptions<Props, D, C, M, Mixin, Extends>,
    ComponentInternalOptions,
    ComponentCustomOptions {
    setup?: () => Promise<RawBindings> | RawBindings | RenderFunction | void
    name?: string,
    template?: string | object // 可以是直接 DOM
    // Note: we are intentionally using the signature-less `Function` type here
    // since any type with signature will cause the whole inference to fail when
    // the return expression contains reference to `this`.
    // Luckily `render()` doesn't need any arguments nor does it care about return
    // type.
    render?: Function
    components: Record<string, Component>
    directive?: Record<string, Directive>
    inheritAttrs?: boolean,
    emits?: (E | EE[]) & ThisType<void>
    //  根据暴露的密钥来推断公共实例类型
    expose?: string[]

    serverPrefetch?(): Promise<any>
}

export type OptionTypesKeys = 'P' | 'B' | 'D' | 'C' | 'M' | 'Defaults'
export type OptionTypesType<P = {},
    B = {},
    D = {},
    C extends ComputedOptions = {},
    M extends MethodOptions = {},
    Defaults = {}> = {
    P: P,
    B: B,
    D: D,
    C: C,
    M: M,
    Defaults: Defaults
}

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
        Readonly<Props>>>

function mergeOptions(to: any, from: any, instance: ComponentInternalInstance) {
    const strats = instance.appContext.config.optionMergeStrategies
    const {mixins, extends: extendsOptions} = from
    extendsOptions && mergeOptions(to, extendsOptions, instance)
    mixins && mixins.forEach((m: ComponentOptionsMixin) => mergeOptions(to, m, instance))

    for (const key in from) {
        if (strats && hasOwn(strats, key)) {
            to[key] = strats[key](to[key], from[key], instance.proxy, key)
        } else {
            to[key] = from[key]
        }
    }
}

export function resolveMergedOptions(
    instance: ComponentInternalInstance
): ComponentOptions {
    const raw = instance.type as ComponentOptions
    const {__merged, mixins, extends: extendsOptions} = raw
    if (__merged) return __merged
    const globalMixins = instance.appContext.mixins
    if (!globalMixins.length && !mixins && !extendsOptions) return raw
    const options = {}
    globalMixins.forEach(m => mergeOptions(options, m, instance))
    mergeOptions(options, raw, instance)
    return (raw.__merged = options)
}
