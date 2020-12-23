import {TrackOpTypes, TriggerOpTypes} from "./operations";
import {isArray, isIntegerKey, isMap, EMPTY_OBJ} from "@vue/shared";


/******* 全局变量 **********/
const targetMap = new WeakMap<any, KeyToDepMap>()
let activeEffect: ReactiveEffect | undefined
const trackStack: boolean[] = []
let shouldTrack = true
let uid = 0
export const ITERATE_KEY = Symbol(__DEV__ ? "iterate" : "")
export const MAP_KEY_ITERATE_KEY = Symbol(__DEV__ ? "Map key iterate" : "")
const effectStack: ReactiveEffect[] = []

/******* interfere 声明****/
export function isEffect(fn: any): fn is ReactiveEffect {
    return fn && fn._isEffect
}

export function enableTracking() {
    trackStack.push(shouldTrack)
    shouldTrack = true
}

export function resetTracking() {
    const last = trackStack.pop()
    shouldTrack = last === undefined ? true : last
}

export interface ReactiveEffect<T = any> {
    (): T;

    _isEffect: true;
    id: number;
    active: boolean;
    raw: () => T;
    deps: Array<Dep>;
    options: ReactiveEffectOptions;
    allowRecurse: boolean;
}

export interface ReactiveEffectOptions {
    lazy?: boolean
    scheduler?: (job: ReactiveEffect) => void;
    onTrack?: (event: DebuggerEvent) => void;
    onTrigger?: (event: DebuggerEvent) => void
    onStop?: () => void;
    allowRecurse?: boolean;
}

export interface DebuggerEventExtraInfo {
    newValue?: any;
    oldValue?: any;
    oldTarget?: Map<any, any> | Set<any>;
}

/******* type 声明*********/
type Dep = Set<ReactiveEffect>;
type KeyToDepMap = Map<any, Dep>
export type DebuggerEvent = {
    effect: ReactiveEffect;
    target: object;
    type: TrackOpTypes | TriggerOpTypes;
    key: any;
} & DebuggerEventExtraInfo;

/******* 函数声明 **********/

// TODO:track 函数是干嘛的？
export function track(target: object, type: TrackOpTypes, key: unknown) {
    if (!shouldTrack || activeEffect === undefined) {
        return
    }

    let depMap = targetMap.get(target)
    if (!depMap) targetMap.set(target, (depMap = new Map()))

    let dep = depMap.get(key)
    if (!dep) depMap.set(key, (dep = new Set()))

    if (!dep.has(activeEffect)) {
        dep.add(activeEffect)
        activeEffect.deps.push(dep)

        if (__DEV__ && activeEffect.options.onTrack) {
            activeEffect.options.onTrack({
                effect: activeEffect,
                target,
                type,
                key
            })
        }
    }
}

export function trigger(
    target: object,
    type: TriggerOpTypes,
    key?: unknown,
    newValue?: unknown,
    oldValue?: unknown,
    oldTarget?: Map<unknown, unknown> | Set<unknown>
) {
    const depsMap = targetMap.get(target)
    if (!depsMap) {
        // 无法追踪
        return
    }

    const effects = new Set<ReactiveEffect>()
    const add = (effectsToAdd: Set<ReactiveEffect> | undefined) => {
        if (effectsToAdd) {
            effectsToAdd.forEach(effect => {
                if (effect !== activeEffect || effect.allowRecurse) {
                    effects.add(effect)
                }
            })
        }
    }

    if (type === TriggerOpTypes.CLEAR) {
        // 清仓
        // 触发目标的所有副作用
        depsMap.forEach(add)
    } else if (key === 'length' && isArray(target)) {
        depsMap.forEach((dep, key) => {
            if (key === 'length' || key >= (newValue as number)) {
                add(dep)
            }
        })
    } else {
        // 计划运行 SET | ADD | DELETE
        if (key !== void 0) {
            add(depsMap.get(key))
        }

        // 也可以在 ADD | DELETE | MAP.SET 执行 迭代 KEY
        switch (type) {
            case TriggerOpTypes.ADD:
                if (!isArray(target)) {
                    add(depsMap.get(ITERATE_KEY))
                    if (isMap(target)) {
                        add(depsMap.get(MAP_KEY_ITERATE_KEY))
                    }
                } else if (isIntegerKey(key)) {
                    // 新的索引添加到数组 -> 长度改变
                    add(depsMap.get("length"))
                }
                break
            case TriggerOpTypes.DELETE:
                if (!isArray(target)) {
                    add(depsMap.get(ITERATE_KEY))
                    if (isMap(target)) {
                        add(depsMap.get(MAP_KEY_ITERATE_KEY))
                    }
                }
                break
            case TriggerOpTypes.SET:
                if (isMap(target)) {
                    add(depsMap.get(ITERATE_KEY))
                }
                break
        }
    }

    const run = (effect: ReactiveEffect) => {
        if (__DEV__ && effect.options.onTrigger) {
            effect.options.onTrigger({
                effect,
                target,
                key,
                type,
                newValue,
                oldValue,
                oldTarget
            })
        }
        if (effect.options.scheduler) {
            effect.options.scheduler(effect)
        } else effect()
    }
    effects.forEach(run)
}


// effect
export function effect<T = any>(
    fn: () => T,
    options: ReactiveEffectOptions = EMPTY_OBJ
): ReactiveEffect<T> {
    if (isEffect(fn)) {
        fn = fn.raw
    }

    const effect = createReactiveEffect(fn, options)
    if (!options.lazy) {
        effect()
    }
    return effect
}

function createReactiveEffect<T = any>(
    fn: () => T,
    options: ReactiveEffectOptions
): ReactiveEffect<T> {
    const effect = function reactiveEffect(): unknown {
        if (!effect.active) {
            return options.scheduler ? undefined : fn()
        }
        if (!effectStack.includes(effect)) {
            cleanup(effect)
        }
        try {
            enableTracking()
            effectStack.push(effect)
            activeEffect = effect
            return fn()
        } finally {
            effectStack.pop() // 移除最后一个
            resetTracking()
            activeEffect = effectStack[effectStack.length - 1]
        }
    } as ReactiveEffect
    effect.id = uid++
    effect.allowRecurse = !!options.allowRecurse
    effect._isEffect = true
    effect.active = true
    effect.raw = fn
    effect.deps = []
    effect.options = options
    return effect
}

function cleanup(effect: ReactiveEffect) {
    const {deps} = effect
    if (deps.length) {
        for (let i = 0; i < deps.length; i++) {
            deps[i].delete(effect)
        }
        deps.length = 0
    }
}
