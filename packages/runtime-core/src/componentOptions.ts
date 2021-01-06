import {ComputedGetter, WritableComputedOptions} from "@vue/reactivity";
import {ComponentInternalInstance, Data} from "./component";
import {PropOptions, PropType} from "./componentProps";

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
    render?: Function
    components: Record<string, Component>
    directive?: Record<string, Directive>
    inheritAttrs?: boolean,
    emits?: (E | EE[]) & ThisType<void>
    // TODO: 根据暴露的密钥来推断公共实例类型
    expose?: string[]

    serverPrefetch?(): Promise<any>

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
