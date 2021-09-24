import {reactive, ReactiveFlags, readonly, toRaw} from "./reactive";
import {capitalize, hasChanged, hasOwn, isMap, isObject, toRawType} from "@vue/shared";
import {ITERATE_KEY, MAP_KEY_ITERATE_KEY, track, trigger} from "./effect";
import {TrackOpTypes, TriggerOpTypes} from "./operations";
import CollatorOptions = Intl.CollatorOptions;

export type CollectionTypes = IterableCollections | WeakCollections

type IterableCollections = Map<any, any> | Set<any>
type WeakCollections = WeakMap<any, any> | WeakSet<any>
type MapTypes = Map<any, any> | WeakMap<any, any>
type SetTypes = Set<any> | WeakSet<any>

interface IterationResult {
    value: any
    done: boolean
}

interface Iterator {
    next(value?: any): IterationResult
}

interface Iterable {
    [Symbol.iterator](): Iterator
}

const toReactive = <T extends unknown>(value: T): T => isObject(value) ? reactive(value) : value
const toReadonly = <T extends unknown>(value: T): T => isObject(value) ? readonly(value as Record<any, any>) : value
const toShallow = <T extends unknown>(value: T): T => value
const getProto = <T extends CollectionTypes>(v: T): any => Reflect.getPrototypeOf(v)

// TODO：为什么这里不写成 class？
const shallowInstrumentations: Record<string, Function> = {
    get(this: MapTypes, key: unknown) {
        return get(this, key, false, true)
    },
    get size() {
        return size((this as unknown) as IterableCollections)
    },
    has,
    add,
    set,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false, true)
}
const mutableInstrumentations: Record<string, Function> = {
    get(this: MapTypes, key: unknown) {
        return get(this, key)
    },
    get size() {
        return size((this as unknown) as IterableCollections)
    },
    has,
    add,
    set,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false, false)
}

// TODO: 为什么不成一个 class？
const readonlyInstrumentations: Record<string, Function> = {
    get(this: MapTypes, key: unknown) {
        return get(this, key, true)
    },
    get size() {
        return size((this as unknown) as IterableCollections, true)
    },
    has(this: MapTypes, key: unknown) {
        return has.call(this, key, true)
    },
    add: createReadonlyMethod(TriggerOpTypes.ADD),
    set: createReadonlyMethod(TriggerOpTypes.SET),
    delete: createReadonlyMethod(TriggerOpTypes.DELETE),
    clear: createReadonlyMethod(TriggerOpTypes.CLEAR),
    forEach: createForEach(true, false),
}
function createIterableMethod(
    method: string | symbol,
    isReadonly: boolean,
    isShallow: boolean
) {
    return function (
        this: IterableCollections,
        ...args: unknown[]
    ): Iterable & Iterator {
        const target = (this as any)[ReactiveFlags.RAW]
        const rawTarget = toRaw(target)
        const targetIsMap = isMap(rawTarget)
        const isPair = method === 'entries' || (method === Symbol.iterator && targetIsMap)
        const isKeyOnly = method === 'keys' && targetIsMap
        const innerIterator = target[method](...args)
        const wrap = isReadonly ? toReadonly : isShallow ? toShallow : toReactive
        !isReadonly && track(
            rawTarget,
            TrackOpTypes.ITERATE,
            isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY
        )
        // 返回一个封装的迭代器，该迭代器返回真实迭代器抛出的值得观测版
        return {
            // 迭代器 protocol
            next() {
                const {value, done} = innerIterator.next()
                return done
                    ? {value, done}
                    : {
                        value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
                        done
                    }
            },
            // iterator protocol
            [Symbol.iterator]() {
                return this
            }
        }
    }
}


// TODO：2020年12月27日23:50:10遗漏了此部分，导致：TypeError: Method Set.prototype.values called on incompatible receiver [object Object]
const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator]
iteratorMethods.forEach(method => {
    mutableInstrumentations[method as string] = createIterableMethod(
        method,
        false,
        false
    )
    readonlyInstrumentations[method as string] = createIterableMethod(
        method,
        true,
        false
    )
    shallowInstrumentations[method as string] = createIterableMethod(
        method,
        false,
        true
    )
})


function createReadonlyMethod(type: TriggerOpTypes): Function {
    return function (this: CollatorOptions, ...args: unknown[]) {
        if (__DEV__) {
            const key = args[0] ? `on key "${args[0]}"` : ``
            console.warn(
                `${capitalize(type)} operation ${key} failed: target is readonly.`,
                toRaw(this)
            );
        }
    }
}

// shallowInstrumentations add
function add(this: SetTypes, value: unknown) {
    value = toRaw(value)
    const target = toRaw(this)
    const proto = getProto(target)
    const hasKey = proto.has.call(target, value)
    const result = target.add(value)
    if (!hasKey) {
        trigger(target, TriggerOpTypes.ADD, value, value)
    }
    return result
}

// shallowInstrumentations has
function has(this: CollectionTypes, key: unknown, isReadonly = false): boolean {
    const target = (this as any) [ReactiveFlags.RAW]
    const rawTarget = toRaw(target)
    const rawKey = toRaw(key)
    if (key !== rawKey) {
        !isReadonly && track(rawTarget, TrackOpTypes.HAS, key)
    }
    !isReadonly && track(rawTarget, TrackOpTypes.HAS, rawKey)
    return key === rawKey ? target.has(key) : target.has(key) || target.has(rawKey)
}

// shallowInstrumentations size
function size(target: IterableCollections, isReadonly = false) {
    target = (target as any) [ReactiveFlags.RAW]
    !isReadonly && track(toRaw(target), TrackOpTypes.ITERATE, ITERATE_KEY)
    return Reflect.get(target, "size", target)
}

// shallowInstrumentations get
function get(
    target: MapTypes,
    key: unknown,
    isReadonly = false,
    isShallow = false
) {
    // #1772: readonly(reactive(Map)) should return readonly + reactive version
    // of the value
    target = (target as any)[ReactiveFlags.RAW]
    const rawTarget = toRaw(target)
    const rawKey = toRaw(key)

    if (key !== rawKey) {
        !isReadonly && track(rawTarget, TrackOpTypes.GET, key)
    }
    !isReadonly && track(rawTarget, TrackOpTypes.GET, rawKey)

    const {has} = getProto(rawTarget)
    const wrap = isReadonly ? toReadonly : isShallow ? toShallow : toReactive
    if (has.call(rawTarget, key)) {
        return wrap(target.get(key))
    } else if (has.call(rawTarget, rawKey)) {
        return wrap(target.get(rawKey))
    }
}

// shallowInstrumentations set
function set(this: MapTypes, key: unknown, value: unknown) {
    value = toRaw(value)
    const target = toRaw(this)
    const {has, get} = getProto(target)

    let hadKey = has.call(target, key)
    if (!hadKey) {
        key = toRaw(key)
        hadKey = has.call(target, key)
    } else if (__DEV__) {
        checkIdentityKeys(target, has, key)
    }

    const oldValue = get.call(target, key)
    const result = target.set(key, value)
    if (!hadKey) {
        trigger(target, TriggerOpTypes.ADD, key, value)
    } else if (hasChanged(value, oldValue)) {
        trigger(target, TriggerOpTypes.SET, key, value, oldValue)
    }
    return result
}

// shallowInstrumentations deletEntry
function deleteEntry(this: CollectionTypes, key: unknown) {
    const target = toRaw(this)
    const {has, get} = getProto(target)
    let hadKey = has.call(target, key)
    if (!hadKey) {
        key = toRaw(key)
        hadKey = has.call(target, key)
    } else if (__DEV__) {
        checkIdentityKeys(target, has, key)
    }

    const oldValue = get ? get.call(target, key) : undefined
    // 前置操作，再排队响应化
    const result = target.delete(key)
    if (hadKey) {
        trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
    }
    return result
}

// shallowInstrumentations clear
function clear(this: IterableCollections) {
    const target = toRaw(this)
    const hadItems = target.size !== 0
    const oldTarget = __DEV__ ? isMap(target) ? new Map(target) : new Set(target) : undefined
    // 前置操作，再排队响应化
    const result = target.clear()
    if (hadItems) {
        trigger(target, TriggerOpTypes.CLEAR, undefined, undefined, oldTarget)
    }
    return result
}

// shallowInstrumentations createForEach
function createForEach(isReadonly: boolean, isShallow: boolean) {
    return function forEach(
        this: IterableCollections,
        callback: Function,
        thisArg?: unknown
    ) {
        const observed = this as any // 观察者
        const target = observed[ReactiveFlags.RAW]
        const rawTarget = toRaw(target)
        const wrap = isReadonly ? toReadonly : isShallow ? toShallow : toReactive!
        isReadonly && track(rawTarget, TrackOpTypes.ITERATE, ITERATE_KEY)
        return target.forEach((value: unknown, key: unknown) => {
            // 重要！确保回调符合以下要求：
            // 1. 被调用的响应式映射为 `this` 和 第三个参数
            // 2. 收集器的值应该是一个对应的 reactive/readonly
            return callback.call(thisArg, wrap(value), wrap(key), observed)
        })
    }
}


function createInstrumentationGetter(isReadonly: boolean, shallow: boolean) {
    const instrumentations = shallow
        ? shallowInstrumentations
        : isReadonly
            ? readonlyInstrumentations
            : mutableInstrumentations
    return (
        target: CollectionTypes,
        key: string | symbol,
        receiver: CollectionTypes) => {
        if (key === ReactiveFlags.IS_REACTIVE) {
            return !isReadonly
        } else if (key === ReactiveFlags.IS_READONLY) {
            return isReadonly
        } else if (key === ReactiveFlags.RAW) {
            return target
        }
        return Reflect.get(
            hasOwn(instrumentations, key) && key in target ? instrumentations : target,
            key,
            receiver
        )
    };
}

export const mutableCollectionHandlers: ProxyHandler<CollectionTypes> = {
    get: createInstrumentationGetter(false, false)
}

// 浅层收集器
export const shallowCollectionHandlers: ProxyHandler<CollectionTypes> = {
    get: createInstrumentationGetter(false, true)
}

// 只读依赖收集处理器
export const readonlyCollectionHandlers: ProxyHandler<CollectionTypes> = {
    get: createInstrumentationGetter(true, false)
}

// 检查缩进key
function checkIdentityKeys(
    target: CollectionTypes,
    has: (key: unknown) => boolean,
    key: unknown
) {
    const rawKey = toRaw(key)
    if (rawKey !== key && has.call(target, rawKey)) {
        const type = toRawType(target)
        console.warn(
          `Reactive ${type} contains both the raw and reactive ` +
          `versions of the same object${type === `Map` ? ` as keys` : ``}, ` +
          `which can lead to inconsistencies. ` +
          `Avoid differentiating between the raw and reactive versions ` +
          `of an object and only use the reactive version if possible.`
        )
    }
}
