import {BooleanFlags, ComponentOptions} from "./componentOptions";
import {ConcreteComponent, Data} from "./component";
import {AppContext} from "./apiCreateApp";
import {EMPTY_ARR, extend, isArray, isFunction, isString} from "@vue/shared";


type PropMethod<T, TConstructor = any> = T extends (...args: any) => any // 如果是带 args 的函数
    ? { new(): TConstructor; (): T; readonly prototype: TConstructor } // 像构造函数一样创建函数
    : never

type PropConstructor<T = any> = | { new(...args: any[]): T & object } | { (): T } | PropMethod<T>
export type PropType<T> = PropConstructor<T> | PropConstructor<T>[]

type DefaultFactory<T> = (props: Data) => T | null | undefined

// TODO: 因与 ComponentOptions.ts 重复，所以这里公开
export interface PropOptions<T = any, D = T> {
    type?: PropType<T> | true | null
    required?: boolean
    default?: D | DefaultFactory<D> | null | undefined | object

    validator?(value: unknown): boolean
}

type NormalizedProp =
    | null
    | (PropOptions & {
    [BooleanFlags.shouldCast]?: boolean
    [BooleanFlags.shouldCastTrue]?: boolean
})
export type NormalizedProps = Record<string, NormalizedProp>
export type NormalizedPropsOptions = [NormalizedProps, string[]] | []

export function normalizePropsOptions(
    comp: ConcreteComponent,
    appContext: AppContext,
    asMixin = false
): NormalizedPropsOptions {
    if (!appContext.deopt && comp.__props) {
        return comp.__props
    }
    const raw = comp.props
    const normalized: NormalizedPropsOptions[0] = []
    const needCastKeys: NormalizedPropsOptions[1] = []

    // 应用 mixin/extends props
    let hasExtends = false
    if (__FEATURE_OPTIONS_API__ && !isFunction(comp)) {
        const extendProps = (raw: ComponentOptions) => {
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
        return (comp.__props = EMPTY_ARR as any)
    }

    if (isArray(raw)) {
        for (let i = 0; i < raw.length; i++) {
            if (__DEV__ && !isString(raw[i])) {
                warn(`props must be strings when using array syntax.`, raw[i])
            }
        }
    }
}
