import {BooleanFlags, ComponentOptions, Prop} from "./componentOptions";
import {ConcreteComponent, Data} from "./component";
import {warn} from "./warning";
import {AppContext} from "./apiCreateApp";
import {camelize, EMPTY_ARR, EMPTY_OBJ, extend, hasOwn, isArray, isFunction, isObject, isString} from "@vue/shared";


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


// normalized value is a tuple of the actual normalized options
// and an array of prop keys that need value casting (booleans and defaults)
export type NormalizedProps = Record<string, NormalizedProp>
export type NormalizedPropsOptions = [NormalizedProps, string[]] | []

function validatePropName(key: string): boolean {
    if (key[0] !== '$') {
        return true
    } else if (__DEV__) {
        warn(`Invalid prop name: "${key}" is a reserved property.`)
    }
    return false
}

// 使用函数字符串名称来检查类型构造函数，这样它就可以跨vms/iframes工作。
function getType(ctor: Prop<any>): string {
    const match = ctor && ctor.toString().match(/^\s*function (\w+)/)
    return match ? match[1] : ''
}

function isSameType(a: Prop<any>, b: Prop<any>): boolean {
    return getType(a) === getType(b)
}

function getTypeIndex(
    type: Prop<any>,
    expectedTypes: PropType<any> | void | null | true
): number {
    if (isArray(expectedTypes)) {
        for (let i = 0, len = expectedTypes.length; i < len; i++) {
            if (isSameType(expectedTypes[i], type)) {
                return i
            }
        }
    } else if (isFunction(expectedTypes)) {
        return isSameType(expectedTypes, type) ? 0 : -1
    }
    return -1
}

export function normalizePropsOptions(
    comp: ConcreteComponent,
    appContext: AppContext,
    asMixin = false
): NormalizedPropsOptions {
    if (!appContext.deopt && comp.__props) {
        return comp.__props
    }
    const raw = comp.props
    const normalized: NormalizedPropsOptions[0] = {}
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
            if (!raw.hasOwnProperty(key)) continue
            const normalizedKey = camelize(key)
            if (validatePropName(normalizedKey)) {
                const opt = raw[key]
                const prop: NormalizedProp = (normalized[normalizedKey] =
                    isArray(opt) || isFunction(opt) ? {type: opt} : opt)
                if (prop) {
                    const booleanIndex = getTypeIndex(Boolean, prop.type)
                    const stringIndex = getTypeIndex(String, prop.type)
                    prop[BooleanFlags.shouldCast] = booleanIndex > -1
                    prop[BooleanFlags.shouldCastTrue] = stringIndex < 0 || booleanIndex < stringIndex

                    //  如果该 prop 需要 boolean 固定或默认值
                    if (booleanIndex > -1 || hasOwn(prop, 'default')) {
                        needCastKeys.push(normalizedKey)
                    }
                }
            }
        }
    }
    return (comp.__props = [normalized, needCastKeys])
}
