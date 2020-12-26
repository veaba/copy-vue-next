import {CollectionTypes} from "./collectionHandlers";
import {track, trigger} from "./effect";
import {isProxy, isReactive, reactive, toRaw} from "./reactive";
import {TrackOpTypes, TriggerOpTypes} from "./operations";
import {hasChanged, isArray, isObject} from "@vue/shared";

declare const RefSymbol: unique symbol;  // TODO: unique?


export interface Ref<T = any> {
    value: T;

    [RefSymbol]: true;
    /**
     * @internal
     * */
    _shallow?: boolean;
}

export type ShallowUnwrapRef<T> = {
    [K in keyof T]: T[K] extends Ref<infer V> ? V : T[K]
}

type UnwrapRefSimple<T> = T extends | Function
    | CollectionTypes
    | BaseTypes
    | Ref
    | RefUnwrapBailTypes[keyof RefUnwrapBailTypes]
    ? T
    : T extends Array<any>
        ? { [K in keyof T]: UnwrapRefSimple<T[K]> }
        : T extends object ? UnwrappedObject<T> : T
export type UnwrapRef<T> = T extends Ref<infer V> ? UnwrapRefSimple<V> : UnwrapRefSimple<T>

type BaseTypes = string | number | boolean;

type UnwrappedObject<T> = { [P in keyof T]: UnwrapRef<T[P]> } & SymbolExtract<T>

/**
 * @decs 这是一个特殊的 export interfere，用于为其他包声明额外的类型，这些类型应该为 ref 解构。例如，
 * `@vue/runtime-dom` 在其 d.ts 中这样声明：
 * ```ts
 * declare module '@vue/reactivity' {
 *     export interface RefUnwrapBailTypes {
 *         runtimeDOMBailTypes: Node | Window
 *     }
 * }
 * ```
 * 注意: `api-extractor` 不知为何拒绝在生成的 `d.ts`中包含 `declare module` 增量。
 * 所以，我们必须在构建过程中手动将其附加到最终生成的 `d.ts` 中
 * */
export interface RefUnwrapBailTypes {
}

/**
 * @desc 从一个对象中提取所有已知 symbol
 * 在解构对象时，symbol 没有 `in keyof`，这应该涵盖所有已知的symbol
 * */
type SymbolExtract<T> = (T extends { [Symbol.asyncIterator]: infer V }
    ? { [Symbol.asyncIterator]: V }
    : {}) &
    (T extends { [Symbol.hasInstance]: infer V } ? { [Symbol.hasInstance]: V } : {}) &
    (T extends { [Symbol.isConcatSpreadable]: infer V } ? { [Symbol.isConcatSpreadable]: V } : {}) &
    (T extends { [Symbol.iterator]: infer V } ? { [Symbol.iterator]: V } : {}) &
    (T extends { [Symbol.match]: infer V } ? { [Symbol.match]: V } : {}) &
    (T extends { [Symbol.matchAll]: infer V } ? { [Symbol.matchAll]: V } : {}) &
    (T extends { [Symbol.replace]: infer V } ? { [Symbol.replace]: V } : {}) &
    (T extends { [Symbol.search]: infer V } ? { [Symbol.search]: V } : {}) &
    (T extends { [Symbol.species]: infer V } ? { [Symbol.species]: V } : {}) &
    (T extends { [Symbol.split]: infer V } ? { [Symbol.split]: V } : {}) &
    (T extends { [Symbol.toPrimitive]: infer V } ? { [Symbol.toPrimitive]: V } : {}) &
    (T extends { [Symbol.toStringTag]: infer V } ? { [Symbol.toStringTag]: V } : {}) &
    (T extends { [Symbol.unscopables]: infer V } ? { [Symbol.unscopables]: V } : {})

export type ToRef<T> = T extends Ref ? T : Ref<UnwrapRef<T>>
export type ToRefs<T = any> = { [K in keyof T]: ToRef<T[K]> }

export function isRef<T>(r: Ref<T> | unknown): r is Ref<T>
export function isRef(r: any): r is Ref {
    return Boolean(r && r.__v_isRef)
}

export function toRef<T extends object, K extends keyof T>(
    object: T,
    key: K
): ToRef<T[K]> {
    return isRef(object[key]) ? object[key] : (new ObjectRefImpl(object, key) as any)
}

export function toRefs<T extends object>(object: T): ToRefs<T> {
    if (__DEV__ && !isProxy(object)) {
        console.warn(`toRefs() 期待的是一个响应式对象，但收到的缺失一个普通对象`)
    }

    const ret: any = isArray(object) ? new Array(object.length) : {} // 内部补齐length属性
    // 循环追个转为 Ref
    for (const key in object) {
        ret[key] = toRef(object, key)
    }
    return ret
}


export function shallowRef<T extends object>(value: T): T extends Ref ? T : Ref<T>
export function shallowRef<T>(value: T): Ref<T>
export function shallowRef<T = any>(): Ref<T | undefined>
export function shallowRef(value?: unknown) {
    return createRef(value, true)
}

export function triggerRef(ref: Ref) {
    trigger(toRaw(ref), TriggerOpTypes.SET, 'value', __DEV__ ? ref.value : void 0)
}

export function unref<T>(ref: T): T extends Ref<infer V> ? V : T {
    return isRef(ref) ? (ref.value as any) : ref
}

export function ref<T extends object>(value: T): ToRef<T>
export function ref<T>(value: T): Ref<UnwrapRef<T>>
export function ref<T = any>(): Ref<T | undefined>
export function ref(value?: unknown) {
    return createRef(value)
}

const shallowUnwrapHandlers: ProxyHandler<any> = {
    get: (target, key, receiver) => unref(Reflect.get(target, key, receiver)),
    set: (target, key, value, receiver) => {
        const oldValue = target[key]
        if (isRef(oldValue) && !isRef(value)) {
            oldValue.value = value
            return true
        } else return Reflect.set(target, key, value, receiver)
    }
}

export function customRef<T>(factory: CustomRefFactory<T>): Ref<T> {
    return new CustomRefImpl(factory) as any
}

export function proxyRefs<T extends object>(
    objectWithRefs: T
): ShallowUnwrapRef<T> {
    return isReactive(objectWithRefs) ? objectWithRefs : new Proxy(objectWithRefs, shallowUnwrapHandlers)
}

/**
 * @desc 创建响应式引用
 * @param rawValue
 * @param shallow true 表示为shallowRef
 * */
function createRef(rawValue: unknown, shallow = false) {
    if (isRef(rawValue)) return rawValue
    return new RefImpl(rawValue, shallow)
}

const convert = <T extends unknown>(val: T): T => isObject(val) ? reactive(val) : val

// Ref 类实现
class RefImpl<T> {
    private _value: T
    public readonly __v_isRef = true

    constructor(private _rawValue: T, public readonly _shallow = false) {
        this._value = _shallow ? _rawValue : convert(_rawValue)
    }

    get value() {
        track(toRaw(this), TrackOpTypes.GET, 'value')
        return this._value
    }

    set value(newVal) {
        if (hasChanged(toRaw(newVal), this._rawValue)) {
            this._rawValue = newVal
            this._value = this._shallow ? newVal : convert(newVal)
            trigger(toRaw(this), TriggerOpTypes.SET, 'value', newVal)
        }
    }
}

// ObjectRefImpl 类实现
class ObjectRefImpl<T extends object, K extends keyof T> {
    public readonly __v_isRef = true

    constructor(private readonly _object: T, private readonly _key: K) {
    }

    get value() {
        return this._object[this._key]
    }

    set value(newVal) {
        this._object[this._key] = newVal
    }
}

export type CustomRefFactory<T> = (
    track: () => void,
    trigger: () => void,
) => {
    get: () => T,
    set: (value: T) => void
}

// CustomRefImpl 类实现
class CustomRefImpl<T> {
    private readonly _get: ReturnType<CustomRefFactory<T>>['get']  // TODO: 这啥操作？
    private readonly _set: ReturnType<CustomRefFactory<T>>['set']  // TODO: 这啥操作？

    public readonly __v_isRef = true

    constructor(factory: CustomRefFactory<T>) {
        const {get, set} = factory(
            () => track(this, TrackOpTypes.GET, 'value'),
            () => trigger(this, TriggerOpTypes.SET, 'value')
        )
        this._get = get
        this._set = set
    }

    get value() {
        return this._get()
    }

    set value(newVal) {
        this._set(newVal)
    }
}
