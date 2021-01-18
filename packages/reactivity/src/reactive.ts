import { Ref, UnwrapRef } from './ref'
import { isObject, toRawType, def } from '@vue/shared'
import { mutableHandlers, readonlyHandlers, shallowReactiveHandlers, shallowReadonlyHandlers } from './baseHandlers'
import {
  mutableCollectionHandlers,
  readonlyCollectionHandlers,
  shallowCollectionHandlers
} from './collectionHandlers'

export const enum ReactiveFlags {
  SKIP = '__v_skip',
  IS_READONLY = '__v_isReadonly',
  IS_REACTIVE = '__v_isReactive',
  RAW = '__v_raw'
}

const enum TargetType {
  INVALID = 0,
  COMMON = 1,
  COLLECTION = 2
}

function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    case 'Map':
    case 'Set':
    case 'WeakMap':
    case 'WeakSet':
      return TargetType.COLLECTION
    default:
      return TargetType.INVALID

  }
}

export interface Target {
  [ReactiveFlags.SKIP]?: boolean
  [ReactiveFlags.IS_REACTIVE]?: boolean
  [ReactiveFlags.IS_READONLY]?: boolean
  [ReactiveFlags.RAW]?: any
}

export const reactiveMap = new WeakMap<Target, any>()
export const readonlyMap = new WeakMap<Target, any>()

// 仅解构嵌套的 ref
type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRef<T>
type Primitive = string | number | boolean | bigint | symbol | undefined | null  // TODO: bigint
type Builtin = Primitive | Function | Date | Error | RegExp
export type DeepReadonly<T> = T extends Builtin
  ? T
  : T extends Map<infer K, infer V>
    ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
    : T extends ReadonlyMap<infer K, infer V>
      ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
      : T extends WeakMap<infer K, infer V>
        ? WeakMap<DeepReadonly<K>, DeepReadonly<V>>
        : T extends Set<infer U>
          ? ReadonlySet<DeepReadonly<U>>
          : T extends ReadonlySet<infer U>
            ? ReadonlySet<DeepReadonly<U>>
            : T extends WeakSet<infer U>
              ? WeakSet<DeepReadonly<U>>
              : T extends Promise<infer U>
                ? Promise<DeepReadonly<U>>
                : T extends {}
                  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
                  : Readonly<T>

export function isReactive(value: unknown): boolean {
  if (isReadonly(value)) {
    return isReactive((value as Target)[ReactiveFlags.RAW])
  }
  return !!(value && (value as Target)[ReactiveFlags.IS_REACTIVE])
}

export function isReadonly(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_READONLY])
}

export function isProxy(value: unknown): boolean {
  return isReactive(value) || isReadonly(value)
}

/**
 * @desc 创建一个原始对象的 readonly 副本，返回的副本并不是响应式的，但 `readonly` 可以在一个响应式化的对象上调用
 * */
export function readonly<T extends object>(
  target: T
): DeepReadonly<UnwrapNestedRefs<T>> {
  return createReactiveObject(
    target,
    true,
    readonlyHandlers,
    readonlyCollectionHandlers
  )
}

function getTargetType(value: Target) {
  return value[ReactiveFlags.SKIP] || !Object.isExtensible(value) // 判断是否允许新增 property
    ? TargetType.INVALID : targetTypeMap(toRawType(value))
}

// core
function createReactiveObject(
  target: Target,
  isReadonly: boolean,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>) {
  // 如果 target 不是一个对象
  if (!isObject(target)) {
    if (__DEV__) {
      console.warn(`value 无法被响应式化: ${String(target)}`)
    }
    return target
  }
  // 如果 target 已是一个 Proxy，则返回它
  // 例外：在响应式对象上调用 readonly()
  if (target[ReactiveFlags.RAW] && !(isReadonly && target[ReactiveFlags.IS_REACTIVE])) {
    return target
  }

  // target 已有相应的 Proxy
  const proxyMap = isReadonly ? readonlyMap : reactiveMap
  const existingProxy = proxyMap.get(target) // 现有的 Proxy
  if (existingProxy) {
    return existingProxy
  }

  // 只有观测到 value 类型的白名单
  const targetType = getTargetType(target)
  if (targetType === TargetType.INVALID) {
    return target
  }
  const proxy = new Proxy(
    target,
    targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers // TODO: collectionHandler 与 baseHandler 区别
  )
  proxyMap.set(target, proxy)
  return proxy
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
    mutableCollectionHandlers // 可变的收集处理器？
  )
}

/**
 * @desc 返回原始对象浅层响应式副本，其中只有根 property 是响应式
 * 它也不会自动解构 refs (即便是 根级)
 * */
export function shallowReactive<T extends object>(target: T): T {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowCollectionHandlers
  )
}


/**
 * @desc 浅层只读
 * 返回的原始对象的响应式副本，其中只有根级 property 是只读的。
 * 并且不解构 refs 也不递归转换返回的 property
 * */
export function shallowReadonly<T extends object>(
  target: T
): Readonly<{ [K in keyof T]: UnwrapNestedRefs<T[K]> }> {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    readonlyCollectionHandlers
  )
}

/**
 * 返回 `reactive` 或 `readonly` proxy 的原始对象
 * */
export function toRaw<T>(observed: T): T {
  return (
    (observed && toRaw((observed as Target)[ReactiveFlags.RAW])) || observed
  )
}

/**
 * @desc 标记一个对象，使其永远不会被转为 proxy，返回对象本身
 * */
export function markRaw<T extends object>(value: T): T {
  def(value, ReactiveFlags.SKIP, true)
  return value
}
