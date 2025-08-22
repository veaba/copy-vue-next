import { isFunction } from '@vue/shared'
import {
  type DebuggerEvent,
  type DebuggerOptions,
  EffectFlags,
  type Subscriber,
  activeSub,
  batch,
  refreshComputed,
} from './effect'
import type { Ref } from './ref'
import { warn } from './warning'
import { Dep, type Link, globalVersion } from './dep'
import { ReactiveFlags, TrackOpTypes } from './constants'


declare const ComputedRefSymbol: unique symbol
declare const WritableComputedRefSymbol: unique symbol


export type ComputedGetter<T> = (oldValue?: T) => T
export type ComputedSetter<T> = (newValue: T) => void

export interface WritableComputedOptions<T, S = T> {
  get: ComputedGetter<T>
  set: ComputedSetter<S>
}



interface BaseComputedRef<T, S = T> extends Ref<T, S> {
  [ComputedRefSymbol]: true
  /**
  * @deprecated computed no longer uses effect
  */
  effect: ComputedRefImpl
}

export interface WritableComputedRef<T, S = T> extends BaseComputedRef<T, S> {
  [WritableComputedRefSymbol]: true
}

export interface ComputedRef<T = any> extends WritableComputedRef<T> {
  readonly value: T;
}


/**
 * Computed 响应式实现的类，@vue/reactivity 给 vue core 使用的，没有暴露给 主 vue 包
 * */
export class ComputedRefImpl<T = any> implements Subscriber {
  /**
   * @internal
  */
  _value: any = undefined

  /**
   * @internal
  */
  readonly dep: Dep = new Dep(this)
  /**
  * @internal
  */
  readonly __v_isRef = true
  /**
  * @internal
  */
  readonly __v_isReadonly: boolean
  /**
   * 计算属性也是一个订阅者，用于 tracking its dependencies
  */
  /**
   * @internal
  */
  deps?: Link = undefined
  /**
   * @internal
  */
  depsTail?: Link = undefined

  /**
  * @internal
  */
  flags: EffectFlags = EffectFlags.DIRTY

  /**
  * @internal
  */
  globalVersion: number = globalVersion - 1

  /**
   * @internal
   */
  isSSR: boolean
  /**
 * @internal
 */
  next?: Subscriber = undefined

  // 向后兼容
  effect: this = this

  // dev only
  onTrack?: (event: DebuggerEvent) => void
  // dev only
  onTrigger?: (event: DebuggerEvent) => void
  /**
   * dev only
   * @internal
  */
  _warnRecursive?: boolean

  constructor(
    public fn: ComputedGetter<T>,
    private readonly setter: ComputedGetter<T> | undefined,
    isSSR: boolean,

  ) {
    this[ReactiveFlags.IS_READONLY] = !setter
    this.isSSR = isSSR
  }

  /**
   * @internal
   */
  notify(): true | void {
    this.flags |= EffectFlags.DIRTY
    if (!(this.flags & EffectFlags.NOTIFIED) &&
      // 避免无限自循环
      activeSub !== this
    ) {
      batch(this, true) // 是 computed
      return true
    } else if (__DEV__) {
      // TODO WARN
    }
  }

  get value(): T {
    const link = __DEV__
      ? this.dep.track({
        target: this,
        type: TrackOpTypes.GET,
        key: 'value'
      })
      : this.dep.track()

    refreshComputed(this) // 重刷 computed
    // 同步 version 在 评估之后
    if (link) {
      link.version = this.dep.version
    }
    return this._value
  }

  set value(newValue: T) {
    if (this.setter) {
      this.setter(newValue)
    } else if (__DEV__) {
      warn(`写入操作失败，计算属性是只读的`)
    }
  }


}


export function computed<T>(getter: ComputedGetter<T>, debugOptions?: DebuggerOptions): ComputedRef<T>

export function computed<T, S = T>(
  options: WritableComputedOptions<T, S>,
  debugOptions?: DebuggerOptions
): WritableComputedRef<T, S>

export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions,
  isSSR = false
): any {
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T> | undefined

  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }

  const cRef = new ComputedRefImpl(
    getter,
    setter,
    isSSR,
  )

  if (__DEV__ && debugOptions && !isSSR) {
    cRef.onTrack = debugOptions.onTrack
    cRef.onTrigger = debugOptions.onTrigger
  }

  return cRef as any
}
