export const enum ReactiveFlags {
    SKIP = '__v_skip',
    IS_READONLY = '__v_isReadonly',
    IS_REACTIVE = '__v_isReactive',
    RAW = '__v_raw'
}

export interface Target {
    [ReactiveFlags.SKIP]?: boolean
    [ReactiveFlags.IS_REACTIVE]?: boolean
    [ReactiveFlags.IS_READONLY]?: boolean
    [ReactiveFlags.RAW]?: any
}

export const reactiveMap = new WeakMap<Target, any>()
export const readonlyMap = new WeakMap<Target, any>()

type Primitive = string | number | boolean | bigint | symbol | undefined | null  // TODO: bigint
type Builtin = Primitive | Function | Date | Error | RegExp
export type DeepReadonly<T> = T extends Builtin
    ? T:T extends Map<infer K,infer V>
        ?

// TODO 这个方法是做什么？
export function toRaw<T>(observed: T): T {
    return (
        (observed && toRaw((observed as Target)[ReactiveFlags.RAW])) || observed
    )
}

// 只读函数
export function readonly<T extends object>(target: T): DeepReadonly<UnwrapNestedRefs<T>> {
    return createReactiveObject(
        target,
        true,
        readonlyHandlers,
        readonlyCollectionHandlers
    )
}


/**
 * 创建一个原始对象的响应式副本 {reactive:响应式,reactivity:响应性}
 * 1. 响应式转换是 `深层的`，它影响所有的嵌套 property。
 * 2. 在基于ES5实现中，返回的 proxy 是不**等**于原始对象的。
 * 3. 建议只是用响应式 proxy，避免依赖原始对象
 *
 * 响应式对象会自动解构其中包含的 refs，所以在访问和变更它们的值时，不需要使用 `.value`
 *
 * ```js
 * const count = ref(0)
 * const obj =reactive({
 *     count
 * })
 * obj.count++
 * obj.count   // ->1
 * count.value // ->1
 * ```
 * */

export function reactive<T extends object>(target: T): UnwrapNestedRefs<T>

export function reactive(target: object) {
    // 如果尝试观察一个只读的 proxy，则返回只读版本
    if (target && (target as Target)[ReactiveFlags.IS_READONLY]) {
        return target
    }
    // 开始创建响应式对象
    return createReactiveObject(
        target,
        false,
        mutableHandlers, // 可变的处理器？
        mutableCollectionHandlers //可变的收集处理器？
    )
}
