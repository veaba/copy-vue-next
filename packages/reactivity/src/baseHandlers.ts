/** 处理器**/
import {ITERATE_KEY, resetTracking, pauseTracking, track, trigger} from "./effect";
import {TrackOpTypes, TriggerOpTypes} from "./operations";
import {extend, hasChanged, hasOwn, isArray, isIntegerKey, isObject, isSymbol} from "@vue/shared";
import {reactive, ReactiveFlags, reactiveMap, readonly, readonlyMap, Target, toRaw} from "./reactive";
import {isRef} from "./ref";

const get = createGetter()  // 每个getter 都有收集器选项
const set = createSetter()  // 每个setter 都有收集器选择
const readonlyGet = createGetter(true)

const shallowGet = createGetter(false, true)
const shallowSet = createSetter(true)
const shallowReadonlyGet = createGetter(true, true)

const arrayInstrumentations: Record<string, Function> = {}

// instrument identity-sensitive Array methods to account for possible reactive values
// values
;(['includes', 'indexOf', 'lastIndexOf'] as const).forEach(key => {
    const method = Array.prototype[key] as any
    arrayInstrumentations[key] = function (this: unknown[], ...args: unknown[]) {
        const arr = toRaw(this)
        for (let i = 0, l = this.length; i < l; i++) {
            track(arr, TrackOpTypes.GET, i + '')
        }
        // 我们先用原始的 args 来运行方法（可能是反应式的)
        const res = method.apply(arr, args)
        if (res === -1 || res === false) {
            // 如果还不行，就用原始值再运行一遍
            return method.apply(arr, args.map(toRaw))
        } else {
            return res
        }
    }
})

// instrument length-altering 变更 methods ，以免长度被追踪
;(['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach(key => {
    const method = Array.prototype[key] as any
    arrayInstrumentations[key] = function (this: unknown[], ...args: unknown[]) {
        pauseTracking()
        const res = method.apply(this, args)
        resetTracking()
        return res
    }
})

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

/**
 * @readonlyHandlers 无法被setx
 * */
export const readonlyHandlers: ProxyHandler<object> = {
    get: readonlyGet,
    set(target, key) {
        if (__DEV__) {
            console.warn(`Set operation on key "${String(key)}" failed: target is readonly.`, target)
        }
        return true
    },
    deleteProperty(target, key) {
        if (__DEV__) {
            console.warn(`Delete operation on key "${String(key)}" failed: target is readonly.`, target)
        }
        return true
    }
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

function createGetter(isReadonly = false, shallow = false) {
    return function get(target: Target, key: string | symbol, receiver: object) {
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
function createSetter(shallow = false) {
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

// shallow reactive 处理器
export const shallowReactiveHandlers: ProxyHandler<object> = extend(
    {},
    mutableHandlers,
    {
        get: shallowGet,
        set: shallowSet,
    }
)

// shallow readonly 处理器
export const shallowReadonlyHandlers: ProxyHandler<object> = extend(
    {},
    readonlyHandlers,
    {
        get: shallowReadonlyGet
    }
)
