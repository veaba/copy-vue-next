import { TrackOpTypes, TriggerOpTypes } from "./constants"
import { ComputedRef, ReactiveMarker, Ref, RefUnwrapBailTypes, Subscriber, Target, WritableComputedRef } from "./interface"
import { Dep } from "./reactive"

declare const ShallowReactiveMarker: unique symbol
declare const RawSymbol: unique symbol
declare const ShallowRefMarker: unique symbol

export type IterableCollections = (Map<any, any> | Set<any>) & Target
export type WeakCollections = (WeakMap<any, any> | WeakSet<any>) & Target
export type CollectionTypes = IterableCollections | WeakCollections
export type Instrumentations = Record<string | symbol, Function | number>
export type MapTypes = (Map<any, any> | WeakMap<any, any>) & Target
export type SetTypes = (Set<any> | WeakSet<any>) & Target

export type OnCleanup = (cleanupFn: () => void) => void
export type EffectScheduler = (...args: any[]) => any
// If the type T accepts type "any", output type Y, otherwise output type N.
// https://stackoverflow.com/questions/49927523/disallow-call-with-any/49928360#49928360
export type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N


// only unwrap nested ref
export type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRefSimple<T>
export type Reactive<T> = UnwrapNestedRefs<T> &
  (T extends readonly any[] ? ReactiveMarker : {})
export type ShallowReactive<T> = T & { [ShallowReactiveMarker]?: true }

export type ComputedGetter<T> = (oldValue?: T) => T
export type ComputedSetter<T> = (newValue: T) => void

// in the codebase we enforce es2016, but user code may run in environments
// higher than that
export type ArrayMethods = keyof Array<any> | 'findLast' | 'findLastIndex'

export type Raw<T> = T & { [RawSymbol]?: true }

export type KeyToDepMap = Map<any, Dep>
export type WatchStopHandle = () => void
export type WatchSource<T = any> = Ref<T, any> | ComputedRef<T> | (() => T)
export type WatchEffect = (onCleanup: OnCleanup) => void
export type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onCleanup: OnCleanup,
) => any

export type CustomRefFactory<T> = (
  track: () => void,
  trigger: () => void,
) => {
  get: () => T
  set: (value: T) => void
}
export type MaybeRefOrGetter<T = any> = MaybeRef<T> | ComputedRef<T> | (() => T)



export type ToRefs<T = any> = {
  [K in keyof T]: ToRef<T[K]>
}

export type ToRef<T> = IfAny<T, Ref<T>, [T] extends [Ref] ? T : Ref<T>>
type Primitive = string | number | boolean | bigint | symbol | undefined | null // 基本类型
export type Builtin = Primitive | Function | Date | Error | RegExp // 引用类型
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
  : T extends Ref<infer U, unknown>
  ? Readonly<Ref<DeepReadonly<U>>>
  : T extends {}
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : Readonly<T>



export type ShallowRef<T = any, S = T> = Ref<T, S> & {
  [ShallowRefMarker]?: true
}

type DistributeRef<T> = T extends Ref<infer V, unknown> ? V : T

export type MaybeRef<T = any> =
  | T
  | Ref<T>
  | ShallowRef<T>
  | WritableComputedRef<T>

export type ShallowUnwrapRef<T> = {
  [K in keyof T]: DistributeRef<T[K]>
}



export type UnwrapRef<T> =
  T extends ShallowRef<infer V, unknown>
  ? V
  : T extends Ref<infer V, unknown>
  ? UnwrapRefSimple<V>
  : UnwrapRefSimple<T>


export type UnwrapRefSimple<T> = T extends
  | Builtin
  | Ref
  | RefUnwrapBailTypes[keyof RefUnwrapBailTypes]
  | { [RawSymbol]?: true }
  ? T
  : T extends Map<infer K, infer V>
  ? Map<K, UnwrapRefSimple<V>> & UnwrapRef<Omit<T, keyof Map<any, any>>>
  : T extends WeakMap<infer K, infer V>
  ? WeakMap<K, UnwrapRefSimple<V>> &
  UnwrapRef<Omit<T, keyof WeakMap<any, any>>>
  : T extends Set<infer V>
  ? Set<UnwrapRefSimple<V>> & UnwrapRef<Omit<T, keyof Set<any>>>
  : T extends WeakSet<infer V>
  ? WeakSet<UnwrapRefSimple<V>> & UnwrapRef<Omit<T, keyof WeakSet<any>>>
  : T extends ReadonlyArray<any>
  ? { [K in keyof T]: UnwrapRefSimple<T[K]> }
  : T extends object & { [ShallowReactiveMarker]?: never }
  ? {
    [P in keyof T]: P extends symbol ? T[P] : UnwrapRef<T[P]>
  }
  : T
export type DebuggerEventExtraInfo = {
  target: object
  type: TrackOpTypes | TriggerOpTypes
  key: any
  newValue?: any
  oldValue?: any
  oldTarget?: Map<any, any> | Set<any>
}

export type DebuggerEvent = {
  effect: Subscriber
} & DebuggerEventExtraInfo

export type WatchScheduler = (job: () => void, isFirstRun: boolean) => void