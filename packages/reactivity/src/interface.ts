import { EffectFlags, ReactiveFlags, WatchErrorCodes } from './enum'
import { ComputedRefImpl, Link, ReactiveEffect } from './reactive'
import { ComputedGetter, ComputedSetter, DebuggerEvent, EffectScheduler, WatchScheduler, WatchStopHandle } from './type'

declare const ReactiveMarkerSymbol: unique symbol
declare const ComputedRefSymbol: unique symbol
declare const WritableComputedRefSymbol: unique symbol
declare const RefSymbol: unique symbol

export interface WatchHandle extends WatchStopHandle {
  pause: () => void
  resume: () => void
  stop: () => void
}

export interface RefUnwrapBailTypes {}
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

export interface ReactiveEffectOptions extends DebuggerOptions {
  scheduler?: EffectScheduler
  allowRecurse?: boolean
  onStop?: () => void
}

export  interface BaseComputedRef<T, S = T> extends Ref<T, S> {
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
    args?: unknown[]
  ) => void
}


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

