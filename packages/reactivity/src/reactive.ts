/**
 * @features
 * - reactive() 实现
 *   - createReactiveObject
 * - effect() 实现
 * - computed() 实现
 *  - 
 * - toRaw()
 * - ref()
 *  - createRef
 *    - RefImpel
 * 
*/
import {
  capitalize,
  def, EMPTY_OBJ, extend, hasChanged, hasOwn, isArray, isFunction, isIntegerKey, isMap, isObject, isPlainObject, isSet, isSymbol, NOOP, remove, toRawType
} from '@vue/shared'
import { TrackOpTypes, TriggerOpTypes } from './constants'
import { warn } from './warning'

/*** ======> define <=====  ***/
declare const WritableComputedRefSymbol: unique symbol
declare const RefSymbol: unique symbol
declare const RawSymbol: unique symbol
declare const ShallowRefMarker: unique symbol
declare const ShallowReactiveMarker: unique symbol
declare const ReactiveMarkerSymbol: unique symbol
declare const ComputedRefSymbol: unique symbol


let batchDepth = 0 // 批量深度
let batchedSub: Subscriber | undefined //批量订阅者
let batchedComputed: Subscriber | undefined // 批量计算属性
const builtInSymbols = new Set(
  /*@__PURE__*/
  Object.getOwnPropertyNames(Symbol)
    // ios10.x Object.getOwnPropertyNames(Symbol) can enumerate 'arguments' and 'caller'
    // but accessing them on Symbol leads to TypeError because Symbol is a strict mode
    // function
    .filter(key => key !== 'arguments' && key !== 'caller')
    .map(key => Symbol[key as keyof SymbolConstructor])
    .filter(isSymbol),
)
export const reactiveMap: WeakMap<Target, any> = new WeakMap<Target, any>()
export let activeEffectScope: EffectScope | undefined

const arrayProto = Array.prototype

export const ITERATE_KEY: unique symbol = Symbol(
  __DEV__ ? 'Object iterate' : '',
)
export const MAP_KEY_ITERATE_KEY: unique symbol = Symbol(
  __DEV__ ? 'Map keys iterate' : '',
)

export const ARRAY_ITERATE_KEY: unique symbol = Symbol(
  __DEV__ ? 'Array iterate' : '',
)

const isNonTrackableKeys = /*@__PURE__*/ makeMap(`__proto__,__v_isRef,__isVue`)


export let shouldTrack = true;
const trackStack: boolean[] = []
const pausedQueueEffects = new WeakSet<ReactiveEffect>()

export let activeSub: Subscriber | undefined

// computed 计算属性，避免不更新
export let globalVersion = 0

export const targetMap: WeakMap<object, KeyToDepMap> = new WeakMap()
export const shallowReadonlyMap: WeakMap<Target, any> = new WeakMap<
  Target,
  any
>()
export const shallowReactiveMap: WeakMap<Target, any> = new WeakMap<Target, any>()

type KeyToDepMap = Map<any, Dep>
const getProto = <T extends CollectionTypes>(v: T): any =>
  Reflect.getPrototypeOf(v)

export const readonlyMap: WeakMap<Target, any> = new WeakMap<Target, any>()

/*** ======> enum <=====  ***/
export enum ReactiveFlags {
  SKIP = '__v_skip',
  // 判断是响应式
  IS_REACTIVE = '__v_isReactive',
  // 只读，一些对象不希望被改
  IS_READONLY = '__v_isReadonly',
  // 区别深层嵌套
  IS_SHALLOW = '__v_isShallow',
  RAW = '__v_raw',
  IS_REF = '__v_isRef'
}

enum TargetType {
  INVALID = 0,
  COMMON = 1,
  COLLECTION = 2
}

export enum EffectFlags {
  /**
   * ReactiveEffect only
   */
  ACTIVE = 1 << 0,
  RUNNING = 1 << 1,
  TRACKING = 1 << 2,
  NOTIFIED = 1 << 3,
  DIRTY = 1 << 4,
  ALLOW_RECURSE = 1 << 5,
  PAUSED = 1 << 6,
  // 评估
  EVALUATED = 1 << 7,
}

export enum WatchErrorCodes {
  WATCH_GETTER = 2,
  WATCH_CALLBACK,
  WATCH_CLEANUP,
}

/*** ======> type <=====  ***/
type IterableCollections = (Map<any, any> | Set<any>) & Target
type WeakCollections = (WeakMap<any, any> | WeakSet<any>) & Target
type CollectionTypes = IterableCollections | WeakCollections
type Instrumentations = Record<string | symbol, Function | number>
type MapTypes = (Map<any, any> | WeakMap<any, any>) & Target
type SetTypes = (Set<any> | WeakSet<any>) & Target

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
type ArrayMethods = keyof Array<any> | 'findLast' | 'findLastIndex'

export type Raw<T> = T & { [RawSymbol]?: true }

export interface Ref<T = any, S = T> {
  get value(): T
  set value(_: S)
  /**
   * Type differentiator only.
   * We need this to be in public d.ts but don't want it to show up in IDE
   * autocomplete, so we use a private Symbol instead.
   */
  [RefSymbol]: true
}

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

export type WatchStopHandle = () => void

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


/*** ======> interface  <===== ***/

export interface RefUnwrapBailTypes { }
export interface Target {
  [ReactiveFlags.SKIP]?: boolean
  [ReactiveFlags.IS_REACTIVE]?: boolean
  [ReactiveFlags.IS_READONLY]?: boolean
  [ReactiveFlags.IS_SHALLOW]?: boolean
  [ReactiveFlags.RAW]?: any
}

export interface ReactiveMarker {
  [ReactiveMarkerSymbol]?: void
}

export interface ReactiveEffectRunner<T = any> {
  (): T
  effect: ReactiveEffect
}

export interface DebuggerOptions {
  onTrack?: (event: DebuggerEvent) => void
  onTrigger?: (event: DebuggerEvent) => void
}
export interface Subscriber extends DebuggerOptions {
  deps?: Link

  depsTail?: Link

  flags: EffectFlags
  next?: Subscriber
  notify(): true | void
}

interface ReactiveEffectOptions extends DebuggerOptions {
  scheduler?: EffectScheduler
  allowRecurse?: boolean
  onStop?: () => void
}

interface BaseComputedRef<T, S = T> extends Ref<T, S> {
  [ComputedRefSymbol]: true
  /**
   * @deprecated computed no longer uses effect
   */
  effect: ComputedRefImpl
}

export interface ComputedRef<T = any> extends BaseComputedRef<T> {
  readonly value: T
}

export interface WritableComputedOptions<T, S = T> {
  get: ComputedGetter<T>
  set: ComputedSetter<S>
}

export interface WritableComputedRef<T, S = T> extends BaseComputedRef<T, S> {
  [WritableComputedRefSymbol]: true
}

export interface WatchOptions<Immediate = boolean> extends DebuggerOptions {
  immediate?: Immediate
  deep?: boolean | number
  once?: boolean
  scheduler?: WatchScheduler
  onWarn?: (msg: string, ...args: any[]) => void
  /**
   * @internal
   */
  augmentJob?: (job: (...args: any[]) => void) => void
  /**
   * @internal
   */
  call?: (
    fn: Function | Function[],
    type: WatchErrorCodes,
    args?: unknown[],
  ) => void
}


/*** ======> class  <===== ***/
export class EffectScope {
  /**
   * @internal
   */
  private _active = true
  /**
   * @internal track `on` calls, allow `on` call multiple times
   */
  private _on = 0
  /**
   * @internal
   */
  effects: ReactiveEffect[] = []
  /**
   * @internal
   */
  cleanups: (() => void)[] = []

  private _isPaused = false

  /**
   * only assigned by undetached scope
   * @internal
   */
  parent: EffectScope | undefined
  /**
   * record undetached scopes
   * @internal
   */
  scopes: EffectScope[] | undefined
  /**
   * track a child scope's index in its parent's scopes array for optimized
   * removal
   * @internal
   */
  private index: number | undefined

  constructor(public detached = false) {
    this.parent = activeEffectScope
    if (!detached && activeEffectScope) {
      this.index =
        (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
          this,
        ) - 1
    }
  }

  get active(): boolean {
    return this._active
  }

  pause(): void {
    if (this._active) {
      this._isPaused = true
      let i, l
      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].pause()
        }
      }
      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].pause()
      }
    }
  }

  /**
   * Resumes the effect scope, including all child scopes and effects.
   */
  resume(): void {
    if (this._active) {
      if (this._isPaused) {
        this._isPaused = false
        let i, l
        if (this.scopes) {
          for (i = 0, l = this.scopes.length; i < l; i++) {
            this.scopes[i].resume()
          }
        }
        for (i = 0, l = this.effects.length; i < l; i++) {
          this.effects[i].resume()
        }
      }
    }
  }

  run<T>(fn: () => T): T | undefined {
    if (this._active) {
      const currentEffectScope = activeEffectScope
      try {
        activeEffectScope = this
        return fn()
      } finally {
        activeEffectScope = currentEffectScope
      }
    } else if (__DEV__) {
      warn(`cannot run an inactive effect scope.`)
    }
  }

  prevScope: EffectScope | undefined
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on(): void {
    if (++this._on === 1) {
      this.prevScope = activeEffectScope
      activeEffectScope = this
    }
  }

  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off(): void {
    if (this._on > 0 && --this._on === 0) {
      activeEffectScope = this.prevScope
      this.prevScope = undefined
    }
  }

  stop(fromParent?: boolean): void {
    if (this._active) {
      this._active = false
      let i, l
      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].stop()
      }
      this.effects.length = 0

      for (i = 0, l = this.cleanups.length; i < l; i++) {
        this.cleanups[i]()
      }
      this.cleanups.length = 0

      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].stop(true)
        }
        this.scopes.length = 0
      }

      // nested scope, dereference from parent to avoid memory leaks
      if (!this.detached && this.parent && !fromParent) {
        // optimized O(1) removal
        const last = this.parent.scopes!.pop()
        if (last && last !== this) {
          this.parent.scopes![this.index!] = last
          last.index = this.index!
        }
      }
      this.parent = undefined
    }
  }
}

export class ReactiveEffect<T = any> implements Subscriber, ReactiveEffectOptions {
  deps?: Link | undefined
  depsTail?: Link | undefined
  flags: EffectFlags = EffectFlags.ACTIVE | EffectFlags.TRACKING
  next?: Subscriber = undefined
  cleanup?: () => void = undefined
  scheduler?: EffectScheduler = undefined
  onStop?: () => void = undefined
  onTrack?: (event: DebuggerEvent) => void
  onTrigger?: (event: DebuggerEvent) => void

  constructor(public fn: () => T) {
    if (activeEffectScope && activeEffectScope.active) {
      activeEffectScope.effects.push(this)
    }
  }
  pause(): void {
    this.flags |= EffectFlags.PAUSED
  }
  resume(): void {
    if (this.flags & EffectFlags.PAUSED) {
      this.flags &= ~EffectFlags.PAUSED
      if (pausedQueueEffects.has(this)) {
        pausedQueueEffects.delete(this)
        this.trigger()
      }
    }
  }

  notify(): void {
    if (
      this.flags & EffectFlags.RUNNING &&
      !(this.flags & EffectFlags.ALLOW_RECURSE)
    ) {
      return
    }
    if (!(this.flags & EffectFlags.NOTIFIED)) {
      batch(this)
    }
  }
  run(): T {
    if (!(this.flags & EffectFlags.ACTIVE)) {
      // stopped during cleanup
      return this.fn()
    }

    this.flags |= EffectFlags.RUNNING
    cleanupEffect(this)
    prepareDeps(this)
    const prevEffect = activeSub
    const prevShouldTrack = shouldTrack
    activeSub = this
    shouldTrack = true

    try {
      return this.fn()
    } finally {
      if (__DEV__ && activeSub !== this) {
        warn(
          'Active effect was not restored correctly - ' +
          'this is likely a Vue internal bug.',
        )
      }
      cleanupDeps(this)
      activeSub = prevEffect
      shouldTrack = prevShouldTrack
      this.flags &= ~EffectFlags.RUNNING
    }
  }

  stop(): void {
    if (this.flags & EffectFlags.ACTIVE) {
      for (let link = this.deps; link; link = link.nextDep) {
        removeSub(link)
      }
      this.deps = this.depsTail = undefined
      cleanupEffect(this)
      this.onStop && this.onStop()
      this.flags &= ~EffectFlags.ACTIVE
    }
  }

  trigger(): void {
    if (this.flags & EffectFlags.PAUSED) {
      pausedQueueEffects.add(this)
    } else if (this.scheduler) {
      this.scheduler()
    } else {
      this.runIfDirty()
    }
  }


  /**
   * @internal
   */
  runIfDirty(): void {
    if (isDirty(this)) {
      this.run()
    }
  }

  get dirty(): boolean {
    return isDirty(this)
  }
}

/**
 * @internal
*/
class Dep {
  version = 0

  activeLink?: Link = undefined
  subs?: Link = undefined
  subsHead?: Link = undefined
  map?: KeyToDepMap = undefined
  key?: unknown = undefined
  // 订阅者计数器
  sc: number = 0
  readonly __v_skip = true
  constructor(public computed?: ComputedRefImpl | undefined) {
    if (__DEV__) {
      this.subsHead = undefined
    }
  }

  track(debugInfo?: DebuggerEventExtraInfo): Link | undefined {
    if (!activeSub || !shouldTrack || activeSub === this.computed) {
      return
    }

    let link = this.activeLink
    if (link === undefined || link.sub !== activeSub) {
      link = this.activeLink = new Link(activeSub, this)

      if (!activeSub.deps) {
        activeSub.deps = activeSub.depsTail = link
      } else {
        link.prevDep = activeSub.depsTail
        activeSub.depsTail!.nextDep = link
        activeSub.depsTail = link
      }
      addSub(link)
    } else if (link.version === -1) {
      link.version = this.version

      if (link.nextDep) {
        const next = link.nextDep
        next.prevDep = link.prevDep

        if (link.prevDep) {
          link.prevDep.nextDep = next
        }

        link.prevDep = activeSub.depsTail
        link.nextDep = undefined

        activeSub.depsTail!.nextDep = link
        activeSub.depsTail = link

        if (activeSub.deps === link) {
          activeSub.deps = next
        }
      }
    }
    if (__DEV__ && activeSub.onTrack) {
      activeSub.onTrack(
        extend({
          effect: activeSub,
        }, debugInfo),
      )
    }
    return link
  }
  trigger(debugInfo?: DebuggerEventExtraInfo): void {
    this.version++
    globalVersion++
    this.notify(debugInfo)
  }

  notify(debugInfo?: DebuggerEventExtraInfo): void {
    startBatch()
    try {
      if (__DEV__) {
        // subs are notified and batched in reverse-order and then invoked in
        // original order at the end of the batch, but onTrigger hooks should
        // be invoked in original order here.
        for (let head = this.subsHead; head; head = head.nextSub) {
          if (head.sub.onTrigger && !(head.sub.flags & EffectFlags.NOTIFIED)) {
            head.sub.onTrigger(
              extend(
                {
                  effect: head.sub,
                },
                debugInfo,
              ),
            )
          }
        }
      }
      for (let link = this.subs; link; link = link.prevSub) {
        if (link.sub.notify()) {
          // if notify() returns `true`, this is a computed. Also call notify
          // on its dep - it's called here instead of inside computed's notify
          // in order to reduce call stack depth.
          ; (link.sub as ComputedRefImpl).dep.notify()
        }
      }
    } finally {
      endBatch()
    }
  }
}

export class ComputedRefImpl<T = any> implements Subscriber {
  /**
   * @internal
  */
  _value: any = undefined

  readonly dep: Dep = new Dep(this)
  readonly __v_isRef = true
  readonly __v_isReadonly: boolean
  deps?: Link = undefined
  depsTail?: Link | undefined
  flags: EffectFlags = EffectFlags.DIRTY
  globalVersion: number = globalVersion - 1
  isSSR: boolean
  next?: Subscriber | undefined
  effect: this = this
  onTrack?: ((event: DebuggerEvent) => void)
  onTrigger?: ((event: DebuggerEvent) => void)

  _warnRecursive?: boolean

  constructor(
    public fn: ComputedGetter<T>,
    private readonly setter: ComputedSetter<T> | undefined,
    isSSR: boolean
  ) {
    this[ReactiveFlags.IS_READONLY] = !setter
    this.isSSR = isSSR
  }
  notify(): true | void {
    this.flags |= EffectFlags.DIRTY
    if (
      !(this.flags & EffectFlags.NOTIFIED) &&
      // avoid infinite self recursion
      activeSub !== this
    ) {
      batch(this, true)
      return true
    } else if (__DEV__) {
      // TODO warn
    }
  }

  get value(): T {
    const link = __DEV__ ? this.dep.track({ target: this, type: TrackOpTypes.GET, key: 'value' }) : this.dep.track()

    refreshComputed(this)
    if (link) {
      link.version = this.dep.version
    }
    return this._value
  }

  set value(newValue) {
    if (this.setter) {
      this.setter(newValue)
    } else if (__DEV__) {
      warn('操作失败：计算属性的 value 只读')
    }
  }

}

// 双链表描述 track 的依赖
class Link {
  version: number
  nextDep?: Link
  prevDep?: Link
  nextSub?: Link
  prevSub?: Link
  prevActiveLink?: Link
  constructor(
    public sub: Subscriber,
    public dep: Dep
  ) {
    this.version = dep.version
    this.nextDep =
      this.prevDep =
      this.nextSub =
      this.prevSub =
      this.prevActiveLink =
      undefined
  }

}
class BaseReactiveHandler implements ProxyHandler<Target> {
  constructor(
    protected readonly _isReadonly = false,
    protected readonly _isShallow = false
  ) { }

  get(target: Target, key: string | symbol, receiver: object): any {

    if (key === ReactiveFlags.SKIP) return target[ReactiveFlags.SKIP]

    const isReadonly = this._isReadonly,
      isShallow = this._isShallow

    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    } else if (key === ReactiveFlags.IS_SHALLOW) {
      return isShallow
    } else if (key === ReactiveFlags.RAW) {
      if (
        receiver === 
          (isReadonly 
            ? isShallow 
              ? shallowReadonlyMap 
              : readonlyMap 
            : isShallow 
              ? shallowReactiveMap 
              : reactiveMap
          ).get(target) || 
          Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)
      ) {
        return target
      }
      return
    }

    const targetIsArray = isArray(target)

    if (!isReadonly) {
      let fn: Function | undefined
      if (targetIsArray && (fn = arrayInstrumentations[key])) {
        return fn
      }

      if (key === 'haOwnProperty') {
        return hasOwnProperty
      }
    }

    const res = Reflect.get(target, key, isRef(target) ? target : receiver)
    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res
    }

    if (!isReadonly) {
      track(target, TrackOpTypes.GET, key)
    }

    if (isShallow) {
      return res
    }

    if (isRef(res)) {
      return targetIsArray && isIntegerKey(key) ? res : res.value
    }

    if (isObject(res)) {
      return isReadonly ? readonly(res) : reactive(res)
    }
    return res
  }
}
class MutableReactiveHandler extends BaseReactiveHandler {
  constructor(isShallow = false) {
    super(false, isShallow)
  }

  set(target: Record<string | symbol, unknown>, key: string | symbol, value: unknown, receiver: object): boolean {
    let oldValue: unknown = target[key]
    if (!this._isShallow) {
      const isOldValueReadonly = isReadonly(oldValue)
      if (!isShallow(value) && !isReadonly(value)) {
        oldValue = toRaw(oldValue)
        value = toRaw(value)
      }
      if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
        if (isOldValueReadonly) {
          if (__DEV__) {
            warn(
              `set key "${String(key)}" 失败: target 为只读.`,
              target[key],
            )
          }
          return true
        } else {
          oldValue.value = value
          return true
        }

      }
    } else {
      // TODO
    }

    const hadKey =
      isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length
        : hasOwn(target, key)
    const result = Reflect.set(
      target,
      key,
      value,
      isRef(target) ? target : receiver,
    )

    // don't trigger if target is something up in the prototype chain of original
    if (target === toRaw(receiver)) {
      if (!hadKey) {
        trigger(target, TriggerOpTypes.ADD, key, value)
      } else if (hasChanged(value, oldValue)) {
        trigger(target, TriggerOpTypes.SET, key, value, oldValue)
      }
    }
    return result
  }

  deleteProperty(target: Record<string | symbol, unknown>, key: string | symbol): boolean {
    const hadKey = hasOwn(target, key)
    const oldValue = target[key]
    const result = Reflect.deleteProperty(target, key)
    if (result && hadKey) {
      trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
    }
    return result
  }

  has(target: Record<string | symbol, unknown>, key: string | symbol): boolean {
    const result = Reflect.has(target, key)
    if (!isSymbol(key) || !builtInSymbols.has(key)) {
      track(target, TrackOpTypes.HAS, key)
    }
    return result
  }
  ownKeys(target: Record<string | symbol, unknown>): (string | symbol)[] {
    track(
      target,
      TrackOpTypes.ITERATE,
      isArray(target) ? 'length' : ITERATE_KEY,
    )
    return Reflect.ownKeys(target)
  }
}

class ReadonlyReactiveHandler extends BaseReactiveHandler {
  constructor(isShallow = false) {
    super(true, isShallow)
  }

  set(target: object, key: string | symbol) {
    if (__DEV__) {
      warn(
        `set key "${String(key)}" 操作失败: target is readonly.`,
        target,
      )
    }
    return true
  }
  deleteProperty(target: object, key: string | symbol) {
    if (__DEV__) {
      warn(
        `delete key "${String(key)}" 操作: target is readonly.`,
        target,
      )
    }
    return true
  }
}

class RefImpl<T = any> {
  _value: T
  private _rawValue: T
  dep: Dep = new Dep()
  public readonly [ReactiveFlags.IS_REF] = true
  public readonly [ReactiveFlags.IS_SHALLOW]: boolean = false

  constructor(value: T, isShallow: boolean) {

    this._rawValue = isShallow ? value : toRaw(value)
    this._value = isShallow ? value : toReactive(value)
    this[ReactiveFlags.IS_SHALLOW] = isShallow
  }

  get value() {
    if (__DEV__) {
      this.dep.track({
        target: this,
        type: TrackOpTypes.GET,
        key: 'value'
      })
    } else {
      this.dep.track()
    }
    return this._value
  }

  set value(newValue) {
    const oldValue = this._rawValue
    const useDirectValue = this[ReactiveFlags.IS_SHALLOW] ||
      isShallow(newValue) ||
      isReadonly(newValue)

    newValue = useDirectValue ? newValue : toRaw(newValue)

    if (hasChanged(newValue, oldValue)) {
      this._rawValue = newValue
      this._value = useDirectValue ? newValue : toReactive(newValue)
      if (__DEV__) {
        this.dep.trigger({
          target: this,
          type: TriggerOpTypes.SET,
          key: 'value',
          newValue,
          oldValue
        })
      } else {
        this.dep.trigger()
      }
    }
  }
}
/*** ======> function  <===== ***/

export function isReactive(value: unknown): boolean {
  if (isReadonly(value)) {
    return isReactive((value as Target)[ReactiveFlags.RAW])
  }
  return !!(value && (value as Target)[ReactiveFlags.IS_REACTIVE])
}

export function isReadonly(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_READONLY])
}
export function isShallow(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_SHALLOW])
}

export function isProxy(value: any): boolean {
  return value ? !!value[ReactiveFlags.RAW] : false
}

/**
 * Checks if a value is a ref object.
 *
 * @param r - The value to inspect.
 * @see {@link https://vuejs.org/api/reactivity-utilities.html#isref}
 */
export function isRef<T>(r: Ref<T> | unknown): r is Ref<T>
export function isRef(r: any): r is Ref {
  return r ? r[ReactiveFlags.IS_REF] === true : false
}


function isDirty(sub: Subscriber): boolean {
  for (let link = sub.deps; link; link = link.nextDep) {
    if (link.dep.version !== link.version || (link.dep.computed && (refreshComputed(link.dep.computed) || link.dep.version !== link.version))) {
      return true
    }
  }
  // @ts-expect-error， 给 pinia 用的
  if (sub._dirty) {
    return true
  }
  return false
}


const mutableHandlers: ProxyHandler<object> = new MutableReactiveHandler()
const readonlyHandlers: ProxyHandler<object> = new ReadonlyReactiveHandler()
export const shallowReactiveHandlers: MutableReactiveHandler = new MutableReactiveHandler(true)
export const shallowCollectionHandlers: ProxyHandler<CollectionTypes> = {
  get: createInstrumentationGetter(false, true),
}

export const shallowReadonlyHandlers: ReadonlyReactiveHandler = new ReadonlyReactiveHandler(true)

export const shallowReadonlyCollectionHandlers: ProxyHandler<CollectionTypes> =
  {
    get: createInstrumentationGetter(true, true),
  }
export function reactive<T extends object>(target: T): Reactive<T>

export function reactive(target: object): any {
  if (isReadonly(target)) {
    return target
  }
  return createReactiveObject(
    target,
    false,
    mutableHandlers, // 基础处理器
    mutableCollectionHandlers, // 集合处理器
    reactiveMap
  )
}


/**
 * Shallow version of {@link reactive}.
 *
 * Unlike {@link reactive}, there is no deep conversion: only root-level
 * properties are reactive for a shallow reactive object. Property values are
 * stored and exposed as-is - this also means properties with ref values will
 * not be automatically unwrapped.
 *
 * @example
 * ```js
 * const state = shallowReactive({
 *   foo: 1,
 *   nested: {
 *     bar: 2
 *   }
 * })
 *
 * // mutating state's own properties is reactive
 * state.foo++
 *
 * // ...but does not convert nested objects
 * isReactive(state.nested) // false
 *
 * // NOT reactive
 * state.nested.bar++
 * ```
 *
 * @param target - The source object.
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#shallowreactive}
 */
export function shallowReactive<T extends object>(
  target: T,
): ShallowReactive<T> {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowCollectionHandlers,
    shallowReactiveMap,
  )
}

/**
 * Shallow version of {@link readonly}.
 *
 * Unlike {@link readonly}, there is no deep conversion: only root-level
 * properties are made readonly. Property values are stored and exposed as-is -
 * this also means properties with ref values will not be automatically
 * unwrapped.
 *
 * @example
 * ```js
 * const state = shallowReadonly({
 *   foo: 1,
 *   nested: {
 *     bar: 2
 *   }
 * })
 *
 * // mutating state's own properties will fail
 * state.foo++
 *
 * // ...but works on nested objects
 * isReadonly(state.nested) // false
 *
 * // works
 * state.nested.bar++
 * ```
 *
 * @param target - The source object.
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#shallowreadonly}
 */
export function shallowReadonly<T extends object>(target: T): Readonly<T> {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    shallowReadonlyCollectionHandlers,
    shallowReadonlyMap,
  )
}
export function computed<T>(
  getter: ComputedGetter<T>,
  debugOptions?: DebuggerOptions,
): ComputedRef<T>
export function computed<T, S = T>(
  options: WritableComputedOptions<T, S>,
  debugOptions?: DebuggerOptions,
): WritableComputedRef<T, S>
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions,
  isSSR = false,
) {
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T> | undefined

  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }

  const cRef = new ComputedRefImpl(getter, setter, isSSR)

  if (__DEV__ && debugOptions && !isSSR) {
    cRef.onTrack = debugOptions.onTrack
    cRef.onTrigger = debugOptions.onTrigger
  }

  return cRef as any
}


export function effect<T = any>(fn: () => T, options?: ReactiveEffectOptions): ReactiveEffectRunner<T> {

  if ((fn as ReactiveEffectRunner).effect instanceof ReactiveEffect) {
    fn = (fn as ReactiveEffectRunner).effect.fn
  }

  const e = new ReactiveEffect(fn)
  if (options) {
    extend(e, options)
  }
  try {
    e.run()
  } catch (error) {
    e.stop()
    throw error
  }

  const runner = e.run.bind(e) as ReactiveEffectRunner
  runner.effect = e
  return runner
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

function getTargetType(value: Target) {
  return value[ReactiveFlags.SKIP] || !Object.isExtensible(value)
    ? TargetType.INVALID
    : targetTypeMap(toRawType(value))
}
function createReactiveObject(
  target: Target,
  isReadonly: boolean,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<Target, any>
) {

  // 不是对象
  if (!isObject(target)) {
    if (__DEV__) {
      warn(
        `value cannot be made ${isReadonly ? 'readonly' : 'reactive'}: ${String(
          target,
        )}`,
      )
    }
    return target
  }

  // 已是响应式+ 异常情况：对响应式调用 readonly
  if (
    target[ReactiveFlags.RAW] &&
    !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
  ) {
    return target
  }

  // 只观测到特定值得类型
  const targetType = getTargetType(target)
  if (targetType === TargetType.INVALID) {
    return target
  }

  // 已是 proxy
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    return existingProxy
  }

  // 代理它
  const proxy = new Proxy(
    target,
    targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers
  )
  proxyMap.set(target, proxy)
  return proxy
}

function createInstrumentations(
  readonly: boolean,
  shallow: boolean
): Instrumentations {
  // 重新集合方法的实现
  const instrumentations: Instrumentations = {
    get(this: MapTypes, key: unknown) {

      const target = this[ReactiveFlags.RAW]
      const rawTarget = toRaw(target)
      const rawKey = toRaw(key)

      if (!readonly) {
        if (hasChanged(key, rawKey)) {
          track(rawTarget, TrackOpTypes.GET, key)
        }
        track(rawTarget, TrackOpTypes.GET, rawKey)
      }

      const { has } = getProto(rawTarget)
      const wrap = shallow ? toShallow : readonly ? toReadonly : toReactive
      if (has.call(rawTarget, key)) {
        return wrap(target.get(key))
      } else if (has.call(rawTarget, rawKey)) {
        return wrap(target.get(rawKey))
      } else if (target !== rawTarget) {
        // 确保嵌套响应式 Map 可以自己跟踪
        target.get(key)
      }
    },
    get size() {
      const target = (this as unknown as IterableCollections)[ReactiveFlags.RAW]
      !readonly && track(toRaw(target), TrackOpTypes.ITERATE, ITERATE_KEY)
      return target.size
    },
    has(this: CollectionTypes, key: unknown): boolean {
      const target = this[ReactiveFlags.RAW]
      const rawTarget = toRaw(target)
      const rawKey = toRaw(key)
      if (!readonly) {
        if (hasChanged(key, rawKey)) {
          track(rawTarget, TrackOpTypes.HAS, key)
        }
        track(rawTarget, TrackOpTypes.HAS, rawKey)
      }
      return key === rawKey ? target.has(key) : target.has(key) || target.has(rawKey)
    },
    forEach(this: IterableCollections, callback: Function, thisArg?: unknown) {
      const observed = this
      const target = observed[ReactiveFlags.RAW]
      const rawTarget = toRaw(target)

      const wrap = shallow ? toShallow : readonly ? toReadonly : toReactive
      !readonly && track(rawTarget, TrackOpTypes.ITERATE, ITERATE_KEY)

      return target.forEach((value: unknown, key: unknown) => {
        return callback.call(thisArg, wrap(value), wrap(key), observed)
      })
    }
  }

  // 拓展方法
  extend(instrumentations, readonly ? {
    add: createReadonlyMethod(TriggerOpTypes.ADD),
    set: createReadonlyMethod(TriggerOpTypes.SET),
    delete: createReadonlyMethod(TriggerOpTypes.DELETE),
    clear: createReadonlyMethod(TriggerOpTypes.CLEAR),
  } : {
    add(this: SetTypes, value: unknown) {
      if (!shallow && !isShallow(value) && !isReadonly(value)) {
        value = toRaw(value)
      }

      const target = toRaw(this)
      const proto = getProto(target)
      const hadKey = proto.has.call(target, value)

      if (!hadKey) {
        target.add(value)
        trigger(target, TriggerOpTypes.ADD, value, value)
      }

      return this
    },
    set(this: MapTypes, key: unknown, value: unknown) {
      if (!shallow && !isShallow(value) && !isReadonly(value)) {
        value = toRaw(value)
      }

      const target = toRaw(this)
      const { has, get } = getProto(target)

      let hadKey = has.call(target, key)
      if (!hadKey) {
        key = toRaw(key)
        hadKey = has.call(target, key)
      } else if (__DEV__) {
        checkIdentityKeys(target, has, key)
      }

      const oldValue = get.call(target, key)
      target.set(key, value)

      if (!hadKey) {
        trigger(target, TriggerOpTypes.ADD, key, value)
      } else if (hasChanged(value, oldValue)) {
        trigger(target, TriggerOpTypes.SET, key, value, oldValue)
      }
      return this
    },
    delete(this: CollectionTypes, key: unknown) {

      const target = toRaw(this)
      const { has, get } = getProto(target)
      let hadKey = has.call(target, key)
      if (!hadKey) {
        key = toRaw(key)
        hadKey = has.call(target, key)
      } else if (__DEV__) {
        checkIdentityKeys(target, has, key)
      }

      const oldValue = get ? get.call(target, key) : undefined
      // 排队之前前进的操作
      const result = target.delete(key)
      if (hadKey) {
        trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
      }
      return result
    },
    clear(this: IterableCollections) {
      const target = toRaw(this)
      const hadItems = target.size !== 0

      // dev 模式下，收集下 old value
      const oldTarget = __DEV__ ? isMap(target) ? new Map(target) : new Set(target) : undefined
      const result = target.clear()
      if (hadItems) {
        trigger(
          target, TriggerOpTypes.CLEAR, undefined, undefined, oldTarget
        )
      }
      return result
    }
  })

  // 可迭代的方法
  const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator] as const

  iteratorMethods.forEach(method => {
    instrumentations[method] = createIterableMethod(method, readonly, shallow)
  })

  return instrumentations
}

function createInstrumentationGetter(isReadonly: boolean, shallow: boolean) {
  const instrumentations = createInstrumentations(isReadonly, shallow)

  return (
    target: CollectionTypes,
    key: string | symbol,
    receiver: CollectionTypes
  ) => {
    if (key === ReactiveFlags.IS_REACTIVE) return !isReadonly
    else if (key === ReactiveFlags.IS_READONLY) return isReadonly
    else if (key === ReactiveFlags.RAW) return target

    return Reflect.get(
      hasOwn(instrumentations, key) && key in target
        ? instrumentations
        : target,
      key,
      receiver
    )
  }
}

/**
 * Shallow version of {@link ref}.
 *
 * @example
 * ```js
 * const state = shallowRef({ count: 1 })
 *
 * // does NOT trigger change
 * state.value.count = 2
 *
 * // does trigger change
 * state.value = { count: 2 }
 * ```
 *
 * @param value - The "inner value" for the shallow ref.
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#shallowref}
 */
export function shallowRef<T>(
  value: T,
): Ref extends T
  ? T extends Ref
    ? IfAny<T, ShallowRef<T>, T>
    : ShallowRef<T>
  : ShallowRef<T>
export function shallowRef<T = any>(): ShallowRef<T | undefined>
export function shallowRef(value?: unknown) {
  return createRef(value, true)
}


function createRef(rawValue: unknown, shallow: boolean) {

  if (isRef(rawValue)) {
    return rawValue
  }
  return new RefImpl(rawValue, shallow)
}


/**
 * Takes an inner value and returns a reactive and mutable ref object, which
 * has a single property `.value` that points to the inner value.
 *
 * @param value - The object to wrap in the ref.
 * @see {@link https://vuejs.org/api/reactivity-core.html#ref}
 */
export function ref<T>(
  value: T,
): [T] extends [Ref] ? IfAny<T, Ref<T>, T> : Ref<UnwrapRef<T>, UnwrapRef<T> | T>
export function ref<T = any>(): Ref<T | undefined>
export function ref(value?: unknown) {
  return createRef(value, false)
}


export const arrayInstrumentations: Record<string | symbol, Function> = <any>{
  __proto__: null,

  [Symbol.iterator]() {
    return iterator(this, Symbol.iterator, toReactive)
  },

  concat(...args: unknown[]) {
    return reactiveReadArray(this).concat(
      ...args.map(x => (isArray(x) ? reactiveReadArray(x) : x)),
    )
  },

  entries() {
    return iterator(this, 'entries', (value: [number, unknown]) => {
      value[1] = toReactive(value[1])
      return value
    })
  },

  every(
    fn: (item: unknown, index: number, array: unknown[]) => unknown,
    thisArg?: unknown,
  ) {
    return apply(this, 'every', fn, thisArg, undefined, arguments)
  },

  filter(
    fn: (item: unknown, index: number, array: unknown[]) => unknown,
    thisArg?: unknown,
  ) {
    return apply(this, 'filter', fn, thisArg, v => v.map(toReactive), arguments)
  },

  find(
    fn: (item: unknown, index: number, array: unknown[]) => boolean,
    thisArg?: unknown,
  ) {
    return apply(this, 'find', fn, thisArg, toReactive, arguments)
  },

  findIndex(
    fn: (item: unknown, index: number, array: unknown[]) => boolean,
    thisArg?: unknown,
  ) {
    return apply(this, 'findIndex', fn, thisArg, undefined, arguments)
  },

  findLast(
    fn: (item: unknown, index: number, array: unknown[]) => boolean,
    thisArg?: unknown,
  ) {
    return apply(this, 'findLast', fn, thisArg, toReactive, arguments)
  },

  findLastIndex(
    fn: (item: unknown, index: number, array: unknown[]) => boolean,
    thisArg?: unknown,
  ) {
    return apply(this, 'findLastIndex', fn, thisArg, undefined, arguments)
  },

  // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement

  forEach(
    fn: (item: unknown, index: number, array: unknown[]) => unknown,
    thisArg?: unknown,
  ) {
    return apply(this, 'forEach', fn, thisArg, undefined, arguments)
  },

  includes(...args: unknown[]) {
    return searchProxy(this, 'includes', args)
  },

  indexOf(...args: unknown[]) {
    return searchProxy(this, 'indexOf', args)
  },

  join(separator?: string) {
    return reactiveReadArray(this).join(separator)
  },

  // keys() iterator only reads `length`, no optimization required

  lastIndexOf(...args: unknown[]) {
    return searchProxy(this, 'lastIndexOf', args)
  },

  map(
    fn: (item: unknown, index: number, array: unknown[]) => unknown,
    thisArg?: unknown,
  ) {
    return apply(this, 'map', fn, thisArg, undefined, arguments)
  },

  pop() {
    return noTracking(this, 'pop')
  },

  push(...args: unknown[]) {
    return noTracking(this, 'push', args)
  },

  reduce(
    fn: (
      acc: unknown,
      item: unknown,
      index: number,
      array: unknown[],
    ) => unknown,
    ...args: unknown[]
  ) {
    return reduce(this, 'reduce', fn, args)
  },

  reduceRight(
    fn: (
      acc: unknown,
      item: unknown,
      index: number,
      array: unknown[],
    ) => unknown,
    ...args: unknown[]
  ) {
    return reduce(this, 'reduceRight', fn, args)
  },

  shift() {
    return noTracking(this, 'shift')
  },

  // slice could use ARRAY_ITERATE but also seems to beg for range tracking

  some(
    fn: (item: unknown, index: number, array: unknown[]) => unknown,
    thisArg?: unknown,
  ) {
    return apply(this, 'some', fn, thisArg, undefined, arguments)
  },

  splice(...args: unknown[]) {
    return noTracking(this, 'splice', args)
  },

  toReversed() {
    // @ts-expect-error user code may run in es2016+
    return reactiveReadArray(this).toReversed()
  },

  toSorted(comparer?: (a: unknown, b: unknown) => number) {
    // @ts-expect-error user code may run in es2016+
    return reactiveReadArray(this).toSorted(comparer)
  },

  toSpliced(...args: unknown[]) {
    // @ts-expect-error user code may run in es2016+
    return (reactiveReadArray(this).toSpliced as any)(...args)
  },

  unshift(...args: unknown[]) {
    return noTracking(this, 'unshift', args)
  },

  values() {
    return iterator(this, 'values', toReactive)
  },
}

/**
 * Track array iteration and return:
 * - if input is reactive: a cloned raw array with reactive values
 * - if input is non-reactive or shallowReactive: the original raw array
 */
export function reactiveReadArray<T>(array: T[]): T[] {
  const raw = toRaw(array)
  if (raw === array) return raw
  track(raw, TrackOpTypes.ITERATE, ARRAY_ITERATE_KEY)
  return isShallow(array) ? raw : raw.map(toReactive)
}


// 创建可迭代的方法
function createIterableMethod(method: string | symbol, isReadonly: boolean, isShallow: boolean) {

  return function (this: IterableCollections, ...args: unknown[]): Iterable<unknown> & Iterator<unknown> {

    const target = this[ReactiveFlags.RAW]
    const rawTarget = toRaw(target)
    const targetIsMap = isMap(rawTarget)

    const isPair = method === 'entries' || (method === Symbol.iterator && targetIsMap)
    const isKeyOnly = method === 'keys' && targetIsMap

    const innerIterator = target[method](...args)

    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive
    !isReadonly && track(
      rawTarget,
      TrackOpTypes.ITERATE,
      isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY
    )
    // 返回包装的迭代器
    return {
      next() {
        const { value, done } = innerIterator.next()
        return done ? { value, done } : { value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value), done }
      },
      [Symbol.iterator]() {
        return this
      }
    }
  }
}

/**
 * 追踪函数
 * @param target
 * @param type
 * @param key 
 * */
export function track(target: object, type: TrackOpTypes, key: unknown): void {
  if (shouldTrack && activeSub) {
    let depsMap = targetMap.get(target)



    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }

    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = new Dep()))
      dep.map = depsMap
      dep.key = key

    }
    if (__DEV__) {
      dep.track({
        target,
        type,
        key
      })
    } else {
      dep.track()
    }
  }
}

// trigger 触发函数
export function trigger(
  target: Target,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>
): void {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    globalVersion++
    return
  }

  const run = (dep: Dep | undefined) => {
    if (dep) {
      if (__DEV__) {
        dep.trigger({
          target,
          type,
          key,
          newValue,
          oldValue,
          oldTarget
        })
      } else {
        dep.trigger()
      }
    }
  }

  startBatch()

  // 清空
  if (type === TriggerOpTypes.CLEAR) {
    // 收集之前清空
    depsMap.forEach(run)
  } else {
    const targetIsArray = isArray(target)
    const isArrayIndex = targetIsArray && isIntegerKey(key)

    if (targetIsArray && key === 'length') {
      const newLength = Number(newValue)

      depsMap.forEach((dep, key) => {
        if (key === 'length' || key === ARRAY_ITERATE_KEY || (!isSymbol(key) && key >= newLength)) {
          run(dep)
        }
      })
    } else {
      // SET、ADD、DELETE 调度
      if (key !== void 0 || depsMap.has(void 0)) {
        run(depsMap.get(key))
      }

      if (isArrayIndex) {
        run(depsMap.get(ARRAY_ITERATE_KEY))
      }

      switch (type) {
        // 添加
        case TriggerOpTypes.ADD:
          if (!targetIsArray) {
            run(depsMap.get(ITERATE_KEY))

            if (isMap(target)) {
              run(depsMap.get(MAP_KEY_ITERATE_KEY))
            }
          } else if (isArrayIndex) {
            run(depsMap.get('length'))
          }
          break
        // 删除
        case TriggerOpTypes.DELETE:
          if (!targetIsArray) {
            run(depsMap.get(ITERATE_KEY))
            if (isMap(target)) {
              run(depsMap.get(MAP_KEY_ITERATE_KEY))
            }
          }
          break
        // 设置
        case TriggerOpTypes.SET:
          if (isMap(target)) {
            run(depsMap.get(ITERATE_KEY))
          }
          break
      }
    }
  }
  endBatch()
}

// 创建 readonly 方法
function createReadonlyMethod(type: TriggerOpTypes): Function {

  return function (this: CollectionTypes, ...args: unknown[]) {

    if (__DEV__) {
      const key = args[0] ? `on key "${args[0]}" ` : ``
      warn(
        `${capitalize(type)} operation ${key}failed: target is readonly.`,
        toRaw(this),
      )
    }

    return type === TriggerOpTypes.DELETE ? false : type === TriggerOpTypes.CLEAR ? undefined : this
  }

}

function startBatch(): void {
  batchDepth++
}

function endBatch(): void {
  if (--batchDepth > 0) {
    return
  }

  if (batchedComputed) {
    let e: Subscriber | undefined = batchedComputed
    batchedComputed = undefined

    while (e) {
      const next: Subscriber | undefined = e.next
      e.next = undefined
      e.flags &= ~EffectFlags.NOTIFIED
      e = next
    }
  }

  let error: unknown
  while (batchedSub) {
    let e: Subscriber | undefined = batchedSub
    batchedSub = undefined

    while (e) {
      const next: Subscriber | undefined = e.next
      e.next = undefined
      e.flags &= ~EffectFlags.NOTIFIED
      if (e.flags & EffectFlags.ACTIVE) {
        try {
          ; (e as ReactiveEffect).trigger()
        } catch (err) {
          if (!error) error = err
        }
      }
      e = next
    }
  }
  if (error) throw error
}

export function shallowReadArray<T>(arr: T[]): T[] {
  track((arr = toRaw(arr)), TrackOpTypes.ITERATE, ARRAY_ITERATE_KEY)
  return arr
}
function iterator(
  self: unknown[],
  method: keyof Array<unknown>,
  wrapValue: (value: any) => unknown,
) {
  // note that taking ARRAY_ITERATE dependency here is not strictly equivalent
  // to calling iterate on the proxied array.
  // creating the iterator does not access any array property:
  // it is only when .next() is called that length and indexes are accessed.
  // pushed to the extreme, an iterator could be created in one effect scope,
  // partially iterated in another, then iterated more in yet another.
  // given that JS iterator can only be read once, this doesn't seem like
  // a plausible use-case, so this tracking simplification seems ok.
  const arr = shallowReadArray(self)
  const iter = (arr[method] as any)() as IterableIterator<unknown> & {
    _next: IterableIterator<unknown>['next']
  }
  if (arr !== self && !isShallow(self)) {
    iter._next = iter.next
    iter.next = () => {
      const result = iter._next()
      if (result.value) {
        result.value = wrapValue(result.value)
      }
      return result
    }
  }
  return iter
}


// 返回原始代理的对象
export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as Target)[ReactiveFlags.RAW]
  return raw ? toRaw(raw) : observed
}

/**
 * Marks an object so that it will never be converted to a proxy. Returns the
 * object itself.
 *
 * @example
 * ```js
 * const foo = markRaw({})
 * console.log(isReactive(reactive(foo))) // false
 *
 * // also works when nested inside other reactive objects
 * const bar = reactive({ foo })
 * console.log(isReactive(bar.foo)) // false
 * ```
 *
 * **Warning:** `markRaw()` together with the shallow APIs such as
 * {@link shallowReactive} allow you to selectively opt-out of the default
 * deep reactive/readonly conversion and embed raw, non-proxied objects in your
 * state graph.
 *
 * @param value - The object to be marked as "raw".
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#markraw}
 */
export function markRaw<T extends object>(value: T): Raw<T> {
  if (!hasOwn(value, ReactiveFlags.SKIP) && Object.isExtensible(value)) {
    def(value, ReactiveFlags.SKIP, true)
  }
  return value
}

export function readonly<T extends object>(
  target: T,
): DeepReadonly<UnwrapNestedRefs<T>> {
  return createReactiveObject(
    target,
    true,
    readonlyHandlers,
    readonlyCollectionHandlers,
    readonlyMap,
  )
}
const toShallow = <T extends unknown>(value: T): T => value

const toReadonly = <T extends unknown>(value: T): DeepReadonly<T> => isObject(value) ? readonly(value) : (value as DeepReadonly<T>)

const toReactive = <T extends unknown>(value: T): T => isObject(value) ? reactive(value) : value


export const mutableCollectionHandlers: ProxyHandler<CollectionTypes> = {
  get: createInstrumentationGetter(false, false),
}


export const readonlyCollectionHandlers: ProxyHandler<CollectionTypes> = {
  get: createInstrumentationGetter(true, true),
}


// 刷新 computed 
function refreshComputed(computed: ComputedRefImpl): undefined {
  if (computed.flags & EffectFlags.TRACKING && !(computed.flags & EffectFlags.DIRTY)) {
    return
  }
  computed.flags &= ~EffectFlags.DIRTY

  if (computed.globalVersion === globalVersion) {
    return
  }

  computed.globalVersion = globalVersion

  if (!computed.isSSR && computed.flags & EffectFlags.EVALUATED && ((!computed.deps && !(computed as any)._dirty) || !isDirty(computed))) {
    return
  }

  computed.flags |= EffectFlags.RUNNING
  const dep = computed.dep
  const prevSub = activeSub
  const prevShouldTrack = shouldTrack
  activeSub = computed
  shouldTrack = true
  try {
    // TODO 干什么？
    prepareDeps(computed)
    const value = computed.fn(computed._value)
    if (dep.version === 0 || hasChanged(value, computed._value)) {
      computed.flags |= EffectFlags.EVALUATED
      computed._value = value
      dep.version++
    }
  } catch (err) {
    dep.version++
    throw err
  } finally {
    activeSub = prevSub
    shouldTrack = prevShouldTrack
    cleanupDeps(computed)
    computed.flags &= ~EffectFlags.RUNNING
  }
}
function checkIdentityKeys(
  target: CollectionTypes,
  has: (key: unknown) => boolean,
  key: unknown,
) {
  const rawKey = toRaw(key)
  if (rawKey !== key && has.call(target, rawKey)) {
    const type = toRawType(target)
    warn(
      `Reactive ${type} contains both the raw and reactive ` +
      `versions of the same object${type === `Map` ? ` as keys` : ``}, ` +
      `which can lead to inconsistencies. ` +
      `Avoid differentiating between the raw and reactive versions ` +
      `of an object and only use the reactive version if possible.`,
    )
  }
}

/******* 数组处理函数 **********/

function apply(
  self: unknown[],
  method: ArrayMethods,
  fn: (item: unknown, index: number, array: unknown[]) => unknown,
  thisArg?: unknown,
  wrappedRetFn?: (result: any) => unknown,
  args?: IArguments,
) {
  const arr = shallowReadArray(self)
  const needsWrap = arr !== self && !isShallow(self)
  // @ts-expect-error our code is limited to es2016 but user code is not
  const methodFn = arr[method]

  // #11759
  // If the method being called is from a user-extended Array, the arguments will be unknown
  // (unknown order and unknown parameter types). In this case, we skip the shallowReadArray
  // handling and directly call apply with self.
  if (methodFn !== arrayProto[method as any]) {
    const result = methodFn.apply(self, args)
    return needsWrap ? toReactive(result) : result
  }

  let wrappedFn = fn
  if (arr !== self) {
    if (needsWrap) {
      wrappedFn = function (this: unknown, item, index) {
        return fn.call(this, toReactive(item), index, self)
      }
    } else if (fn.length > 2) {
      wrappedFn = function (this: unknown, item, index) {
        return fn.call(this, item, index, self)
      }
    }
  }
  const result = methodFn.call(arr, wrappedFn, thisArg)
  return needsWrap && wrappedRetFn ? wrappedRetFn(result) : result
}


// instrument reduce and reduceRight to take ARRAY_ITERATE dependency
function reduce(
  self: unknown[],
  method: keyof Array<any>,
  fn: (acc: unknown, item: unknown, index: number, array: unknown[]) => unknown,
  args: unknown[],
) {
  const arr = shallowReadArray(self)
  let wrappedFn = fn
  if (arr !== self) {
    if (!isShallow(self)) {
      wrappedFn = function (this: unknown, acc, item, index) {
        return fn.call(this, acc, toReactive(item), index, self)
      }
    } else if (fn.length > 3) {
      wrappedFn = function (this: unknown, acc, item, index) {
        return fn.call(this, acc, item, index, self)
      }
    }
  }
  return (arr[method] as any)(wrappedFn, ...args)
}

// instrument length-altering mutation methods to avoid length being tracked
// which leads to infinite loops in some cases (#2137)
function noTracking(
  self: unknown[],
  method: keyof Array<any>,
  args: unknown[] = [],
) {
  pauseTracking()
  startBatch()
  const res = (toRaw(self) as any)[method].apply(self, args)
  endBatch()
  resetTracking()
  return res
}

/**
 * Temporarily pauses tracking.
 */
export function pauseTracking(): void {
  trackStack.push(shouldTrack)
  shouldTrack = false
}

/**
 * Resets the previous global effect tracking state.
 */
export function resetTracking(): void {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}


// instrument identity-sensitive methods to account for reactive proxies
function searchProxy(
  self: unknown[],
  method: keyof Array<any>,
  args: unknown[],
) {
  const arr = toRaw(self) as any
  track(arr, TrackOpTypes.ITERATE, ARRAY_ITERATE_KEY)
  // we run the method using the original args first (which may be reactive)
  const res = arr[method](...args)

  // if that didn't work, run it again using raw values.
  if ((res === -1 || res === false) && isProxy(args[0])) {
    args[0] = toRaw(args[0])
    return arr[method](...args)
  }

  return res
}


export function batch(sub: Subscriber, isComputed = false): void {
  sub.flags |= EffectFlags.NOTIFIED
  if (isComputed) {
    sub.next = batchedComputed
    batchedComputed = sub
    return
  }
  sub.next = batchedSub
  batchedSub = sub
}

function cleanupEffect(e: ReactiveEffect) {
  const { cleanup } = e
  e.cleanup = undefined
  if (cleanup) {
    // run cleanup without active effect
    const prevSub = activeSub
    activeSub = undefined
    try {
      cleanup()
    } finally {
      activeSub = prevSub
    }
  }
}

function prepareDeps(sub: Subscriber) {
  // Prepare deps for tracking, starting from the head
  for (let link = sub.deps; link; link = link.nextDep) {
    // set all previous deps' (if any) version to -1 so that we can track
    // which ones are unused after the run
    link.version = -1
    // store previous active sub if link was being used in another context
    link.prevActiveLink = link.dep.activeLink
    link.dep.activeLink = link
  }
}

function removeSub(link: Link, soft = false) {
  const { dep, prevSub, nextSub } = link
  if (prevSub) {
    prevSub.nextSub = nextSub
    link.prevSub = undefined
  }
  if (nextSub) {
    nextSub.prevSub = prevSub
    link.nextSub = undefined
  }
  if (__DEV__ && dep.subsHead === link) {
    // was previous head, point new head to next
    dep.subsHead = nextSub
  }

  if (dep.subs === link) {
    // was previous tail, point new tail to prev
    dep.subs = prevSub

    if (!prevSub && dep.computed) {
      // if computed, unsubscribe it from all its deps so this computed and its
      // value can be GCed
      dep.computed.flags &= ~EffectFlags.TRACKING
      for (let l = dep.computed.deps; l; l = l.nextDep) {
        // here we are only "soft" unsubscribing because the computed still keeps
        // referencing the deps and the dep should not decrease its sub count
        removeSub(l, true)
      }
    }
  }

  if (!soft && !--dep.sc && dep.map) {
    // #11979
    // property dep no longer has effect subscribers, delete it
    // this mostly is for the case where an object is kept in memory but only a
    // subset of its properties is tracked at one time
    dep.map.delete(dep.key)
  }
}

function cleanupDeps(sub: Subscriber) {
  // Cleanup unused deps
  let head
  let tail = sub.depsTail
  let link = tail
  while (link) {
    const prev = link.prevDep
    if (link.version === -1) {
      if (link === tail) tail = prev
      // unused - remove it from the dep's subscribing effect list
      removeSub(link)
      // also remove it from this effect's dep list
      removeDep(link)
    } else {
      // The new head is the last node seen which wasn't removed
      // from the doubly-linked list
      head = link
    }

    // restore previous active link if any
    link.dep.activeLink = link.prevActiveLink
    link.prevActiveLink = undefined
    link = prev
  }
  // set the new head & tail
  sub.deps = head
  sub.depsTail = tail
}

function removeDep(link: Link) {
  const { prevDep, nextDep } = link
  if (prevDep) {
    prevDep.nextDep = nextDep
    link.prevDep = undefined
  }
  if (nextDep) {
    nextDep.prevDep = prevDep
    link.nextDep = undefined
  }
}

function addSub(link: Link) {
  link.dep.sc++
  if (link.sub.flags & EffectFlags.TRACKING) {
    const computed = link.dep.computed
    // computed getting its first subscriber
    // enable tracking + lazily subscribe to all its deps
    if (computed && !link.dep.subs) {
      computed.flags |= EffectFlags.TRACKING | EffectFlags.DIRTY
      for (let l = computed.deps; l; l = l.nextDep) {
        addSub(l)
      }
    }

    const currentTail = link.dep.subs
    if (currentTail !== link) {
      link.prevSub = currentTail
      if (currentTail) currentTail.nextSub = link
    }

    if (__DEV__ && link.dep.subsHead === undefined) {
      link.dep.subsHead = link
    }

    link.dep.subs = link
  }
}

export function makeMap(str: string): (key: string) => boolean {
  const map = Object.create(null)
  for (const key of str.split(',')) map[key] = 1
  return val => val in map
}

function hasOwnProperty(this: object, key: unknown) {
  // #10455 hasOwnProperty may be called with non-string values
  if (!isSymbol(key)) key = String(key)
  const obj = toRaw(this)
  track(obj, TrackOpTypes.HAS, key)
  return obj.hasOwnProperty(key as string)
}



/**
 * Returns the inner value if the argument is a ref, otherwise return the
 * argument itself. This is a sugar function for
 * `val = isRef(val) ? val.value : val`.
 *
 * @example
 * ```js
 * function useFoo(x: number | Ref<number>) {
 *   const unwrapped = unref(x)
 *   // unwrapped is guaranteed to be number now
 * }
 * ```
 *
 * @param ref - Ref or plain value to be converted into the plain value.
 * @see {@link https://vuejs.org/api/reactivity-utilities.html#unref}
 */
export function unref<T>(ref: MaybeRef<T> | ComputedRef<T>): T {
  return isRef(ref) ? ref.value : ref
}

/************** watch */
export interface WatchHandle extends WatchStopHandle {
  pause: () => void
  resume: () => void
  stop: () => void
}
export type WatchSource<T = any> = Ref<T, any> | ComputedRef<T> | (() => T)
export type WatchEffect = (onCleanup: OnCleanup) => void
export type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onCleanup: OnCleanup,
) => any

const cleanupMap: WeakMap<ReactiveEffect, (() => void)[]> = new WeakMap()
let activeWatcher: ReactiveEffect | undefined = undefined
// initial value for watchers to trigger on undefined initial values
const INITIAL_WATCHER_VALUE = {}

/**
 * Registers a cleanup callback on the current active effect. This
 * registered cleanup callback will be invoked right before the
 * associated effect re-runs.
 *
 * @param cleanupFn - The callback function to attach to the effect's cleanup.
 * @param failSilently - if `true`, will not throw warning when called without
 * an active effect.
 * @param owner - The effect that this cleanup function should be attached to.
 * By default, the current active effect.
 */
export function onWatcherCleanup(
  cleanupFn: () => void,
  failSilently = false,
  owner: ReactiveEffect | undefined = activeWatcher,
): void {
  if (owner) {
    let cleanups = cleanupMap.get(owner)
    if (!cleanups) cleanupMap.set(owner, (cleanups = []))
    cleanups.push(cleanupFn)
  } else if (__DEV__ && !failSilently) {
    warn(
      `onWatcherCleanup() was called when there was no active watcher` +
        ` to associate with.`,
    )
  }
}
/**
 * Returns the current active effect scope if there is one.
 *
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#getcurrentscope}
 */
export function getCurrentScope(): EffectScope | undefined {
  return activeEffectScope
}

// TODO apiWatch 同名 watch函数和 WatchOptions 等
export function watch(
  source: WatchSource | WatchSource[] | WatchEffect | object,
  cb?: WatchCallback | null,
  options: WatchOptions = EMPTY_OBJ,
): WatchHandle {
  const { immediate, deep, once, scheduler, augmentJob, call } = options

  const warnInvalidSource = (s: unknown) => {
    ;(options.onWarn || warn)(
      `Invalid watch source: `,
      s,
      `A watch source can only be a getter/effect function, a ref, ` +
        `a reactive object, or an array of these types.`,
    )
  }

  const reactiveGetter = (source: object) => {
    // traverse will happen in wrapped getter below
    if (deep) return source
    // for `deep: false | 0` or shallow reactive, only traverse root-level properties
    if (isShallow(source) || deep === false || deep === 0)
      return traverse(source, 1)
    // for `deep: undefined` on a reactive object, deeply traverse all properties
    return traverse(source)
  }

  let effect: ReactiveEffect
  let getter: () => any
  let cleanup: (() => void) | undefined
  let boundCleanup: typeof onWatcherCleanup
  let forceTrigger = false
  let isMultiSource = false

  if (isRef(source)) {
    getter = () => source.value
    forceTrigger = isShallow(source)
  } else if (isReactive(source)) {
    getter = () => reactiveGetter(source)
    forceTrigger = true
  } else if (isArray(source)) {
    isMultiSource = true
    forceTrigger = source.some(s => isReactive(s) || isShallow(s))
    getter = () =>
      source.map(s => {
        if (isRef(s)) {
          return s.value
        } else if (isReactive(s)) {
          return reactiveGetter(s)
        } else if (isFunction(s)) {
          return call ? call(s, WatchErrorCodes.WATCH_GETTER) : s()
        } else {
          __DEV__ && warnInvalidSource(s)
        }
      })
  } else if (isFunction(source)) {
    if (cb) {
      // getter with cb
      getter = call
        ? () => call(source, WatchErrorCodes.WATCH_GETTER)
        : (source as () => any)
    } else {
      // no cb -> simple effect
      getter = () => {
        if (cleanup) {
          pauseTracking()
          try {
            cleanup()
          } finally {
            resetTracking()
          }
        }
        const currentEffect = activeWatcher
        activeWatcher = effect
        try {
          return call
            ? call(source, WatchErrorCodes.WATCH_CALLBACK, [boundCleanup])
            : source(boundCleanup)
        } finally {
          activeWatcher = currentEffect
        }
      }
    }
  } else {
    getter = NOOP
    __DEV__ && warnInvalidSource(source)
  }

  if (cb && deep) {
    const baseGetter = getter
    const depth = deep === true ? Infinity : deep
    getter = () => traverse(baseGetter(), depth)
  }

  const scope = getCurrentScope()
  const watchHandle: WatchHandle = () => {
    effect.stop()
    if (scope && scope.active) {
      remove(scope.effects, effect)
    }
  }

  if (once && cb) {
    const _cb = cb
    cb = (...args) => {
      _cb(...args)
      watchHandle()
    }
  }

  let oldValue: any = isMultiSource
    ? new Array((source as []).length).fill(INITIAL_WATCHER_VALUE)
    : INITIAL_WATCHER_VALUE

  const job = (immediateFirstRun?: boolean) => {
    if (
      !(effect.flags & EffectFlags.ACTIVE) ||
      (!effect.dirty && !immediateFirstRun)
    ) {
      return
    }
    if (cb) {
      // watch(source, cb)
      const newValue = effect.run()
      if (
        deep ||
        forceTrigger ||
        (isMultiSource
          ? (newValue as any[]).some((v, i) => hasChanged(v, oldValue[i]))
          : hasChanged(newValue, oldValue))
      ) {
        // cleanup before running cb again
        if (cleanup) {
          cleanup()
        }
        const currentWatcher = activeWatcher
        activeWatcher = effect
        try {
          const args = [
            newValue,
            // pass undefined as the old value when it's changed for the first time
            oldValue === INITIAL_WATCHER_VALUE
              ? undefined
              : isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE
                ? []
                : oldValue,
            boundCleanup,
          ]
          oldValue = newValue
          call
            ? call(cb!, WatchErrorCodes.WATCH_CALLBACK, args)
            : // @ts-expect-error
              cb!(...args)
        } finally {
          activeWatcher = currentWatcher
        }
      }
    } else {
      // watchEffect
      effect.run()
    }
  }

  if (augmentJob) {
    augmentJob(job)
  }

  effect = new ReactiveEffect(getter)

  effect.scheduler = scheduler
    ? () => scheduler(job, false)
    : (job as EffectScheduler)

  boundCleanup = fn => onWatcherCleanup(fn, false, effect)

  cleanup = effect.onStop = () => {
    const cleanups = cleanupMap.get(effect)
    if (cleanups) {
      if (call) {
        call(cleanups, WatchErrorCodes.WATCH_CLEANUP)
      } else {
        for (const cleanup of cleanups) cleanup()
      }
      cleanupMap.delete(effect)
    }
  }

  if (__DEV__) {
    effect.onTrack = options.onTrack
    effect.onTrigger = options.onTrigger
  }

  // initial run
  if (cb) {
    if (immediate) {
      job(true)
    } else {
      oldValue = effect.run()
    }
  } else if (scheduler) {
    scheduler(job.bind(null, true), true)
  } else {
    effect.run()
  }

  watchHandle.pause = effect.pause.bind(effect)
  watchHandle.resume = effect.resume.bind(effect)
  watchHandle.stop = watchHandle

  return watchHandle
}




export function traverse(
  value: unknown,
  depth: number = Infinity,
  seen?: Set<unknown>,
): unknown {
  if (depth <= 0 || !isObject(value) || (value as any)[ReactiveFlags.SKIP]) {
    return value
  }

  seen = seen || new Set()
  if (seen.has(value)) {
    return value
  }
  seen.add(value)
  depth--
  if (isRef(value)) {
    traverse(value.value, depth, seen)
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], depth, seen)
    }
  } else if (isSet(value) || isMap(value)) {
    value.forEach((v: any) => {
      traverse(v, depth, seen)
    })
  } else if (isPlainObject(value)) {
    for (const key in value) {
      traverse(value[key], depth, seen)
    }
    for (const key of Object.getOwnPropertySymbols(value)) {
      if (Object.prototype.propertyIsEnumerable.call(value, key)) {
        traverse(value[key as any], depth, seen)
      }
    }
  }
  return value
}

const shallowUnwrapHandlers: ProxyHandler<any> = {
  get: (target, key, receiver) =>
    key === ReactiveFlags.RAW
      ? target
      : unref(Reflect.get(target, key, receiver)),
  set: (target, key, value, receiver) => {
    const oldValue = target[key]
    if (isRef(oldValue) && !isRef(value)) {
      oldValue.value = value
      return true
    } else {
      return Reflect.set(target, key, value, receiver)
    }
  },
}

/**
 * Returns a proxy for the given object that shallowly unwraps properties that
 * are refs. If the object already is reactive, it's returned as-is. If not, a
 * new reactive proxy is created.
 *
 * @param objectWithRefs - Either an already-reactive object or a simple object
 * that contains refs.
 */
export function proxyRefs<T extends object>(
  objectWithRefs: T,
): ShallowUnwrapRef<T> {
  return isReactive(objectWithRefs)
    ? objectWithRefs
    : new Proxy(objectWithRefs, shallowUnwrapHandlers)
}
