// 在 proxy 上暴露的公共属性，在模板中作为渲染上下文使用（在渲染选项中作为`this`）。

import {
    ComponentOptionsBase,
    ComponentOptionsMixin,
    ComputedOptions, ExtractComputedReturns,
    MethodOptions, OptionTypesKeys, OptionTypesType, resolveMergedOptions
} from "./componentOptions";
import {EmitFn, EmitsOptions} from "./componentEmits";
import {ComponentInternalInstance, Data} from "./component";
import {ReactiveEffect, shallowReadonly, ShallowUnwrapRef} from "@vue/reactivity";
import {Slots} from "./componentSlots";
import {extend, NOOP} from "@vue/shared";
import {UnionToIntersection} from "./helpers/typeUtils";
import {nextTick, queueJob} from "./scheduler/scheduler";
import {instanceWatch, WatchOptions, WatchStopHandle} from "./apiWatch";

export interface ComponentRenderContext {
    [key: string]: any

    _: ComponentInternalInstance
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
