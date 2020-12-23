/** 处理器**/
import {ITERATE_KEY, track, trigger} from "./effect";
import {TrackOpTypes, TriggerOpTypes} from "./operations";
import {hasChanged, hasOwn, isArray, isIntegerKey, isObject, isSymbol} from "@vue/shared";
import {reactive, ReactiveFlags, reactiveMap, readonly, readonlyMap, toRaw} from "./reactive";
import {isRef} from "./ref";

const get = createGetter()  // 每个getter 都有收集器选项
const set = createSetter()  // 每个setter 都有收集器选择

const arrayInstrumentations: Record<string, Function> = {}

// instrument identity-sensitive Array methods to account for possible reactive values

const builtInSymbols = new Set(
    Object.getOwnPropertyNames(Symbol)
        .map(key => (Symbol as any)[key])
        .filter(isSymbol)
)
export const mutableHandlers: ProxyHandler<object> = {
    get,
    set,
    deleteProperty,
    has,
    ownKeys
}

// 删除 prop
function deleteProperty(target: object, key: string | symbol): boolean {
    const hadKey = hasOwn(target, key)
    const oldValue = (target as any)[key]
    const result = Reflect.deleteProperty(target, key)
    if (result && hadKey) {
        trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
    }
    return result
}

function has(target: object, key: string | symbol): boolean {
    const result = Reflect.has(target, key)
    if (!isSymbol(key) || !builtInSymbols.has(key)) {
        track(target, TrackOpTypes.HAS, key)
    }
    return result
}

function ownKeys(target: object): (string | number | symbol)[] {
    track(target, TrackOpTypes.ITERATE, isArray(target) ? 'length' : ITERATE_KEY)
    return Reflect.ownKeys(target)
}


// 创建 getter TODO: 原版不加 可选标志
function createGetter(isReadonly?: false, shallow?: false) {
    return function get(target: object, key: string | symbol, receiver: object) {
        if (key === ReactiveFlags.IS_REACTIVE) {
            return !isReadonly
        } else if (key === ReactiveFlags.IS_READONLY) {
            return isReadonly
        } else if (key === ReactiveFlags.RAW && receiver === (isReadonly ? readonlyMap : reactiveMap).get(target)) {
            return target
        }
        const targetIsArray = isArray(target)
        if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
            return Reflect.get(arrayInstrumentations, key, receiver)
        }
        const res = Reflect.get(target, key, receiver)
        if (isSymbol(key) ? builtInSymbols.has(key as symbol) : key === `__proto__` || key === '__v_isRef') {
            return res
        }

        // 如果存在
        if (!isReadonly) {
            track(target, TrackOpTypes.GET, key)
        }
        if (shallow) {
            return res
        }

        // 如果是 ref，响应式的引用
        if (isRef(res)) {
            // ref 解构，不适用Array、整数 key
            const shouldUnwrap = !targetIsArray || !isIntegerKey(key)
            return shouldUnwrap ? res.value : res
        }

        if (isObject(res)) {
            // 在这里做isObject检查，避免无效值警告
            // 同时需要在这里做懒性访问 readonly 和 响应式，避免循环依赖
            return isReadonly ? readonly(res) : reactive(res)
        }
        return res
    }
}

// 创建 setter
function createSetter(shallow?: false) {
    return function set(
        target: object,
        key: string | symbol,
        value: unknown,
        receiver: object
    ): boolean {
        const oldValue = (target as any)[key]
        if (!shallow) {
            value = toRaw(value)
            // target 不是数组 && 旧值是ref && 值不是 ref
            if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
                oldValue.value = value
                return true
            }
        } else {
            // TODO
            // 在shallow（浅层） 模式下，无论对象是否被动，都原样设置
        }
        const hadKey = isArray(target) && isIntegerKey(key) ? Number(key) < target.length : hasOwn(target, key)
        const result = Reflect.set(target, key, value, receiver)

        // 如果目标是原生原型链上的东西，则不触发
        if (target === toRaw(receiver)) {
            if (!hadKey) {
                trigger(target, TriggerOpTypes.ADD, key, value)
            } else if (hasChanged(value, oldValue)) {
                trigger(target, TriggerOpTypes.SET, key, value, oldValue)
            }
        }
        return result
    }
}

