import { TrackOpTypes, TriggerOpTypes } from "./operations";
import { hasChanged, extend, } from "@vue/shared";
import { type Link, globalVersion } from './dep'
import type { ComputedRefImpl } from './computed'

/******* 全局变量 **********/

let shouldTrack = true
const trackStack: boolean[] = []
let batchedComputed: Subscriber | undefined
let batchedSub: Subscriber | undefined

const pausedQueueEffects = new WeakSet<ReactiveEffect>()
export let activeSub: Subscriber | undefined

export type EffectScheduler = (...args: any[]) => any

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
  EVALUATED = 1 << 7,
}


/******* interfere 声明 ****/

export interface DebuggerOptions {
  onTrack?: (event: DebuggerEvent) => void
  onTrigger?: (event: DebuggerEvent) => void
}

export interface Subscriber extends DebuggerOptions {
  /**
   * 双链列表
   * @internal
  */
  deps?: Link
  /**
   * 尾部链表
   * @internal
  */
  depsTail?: Link

  /**
   * @internal
  */
  flags: EffectFlags
  /**
   * @internal
  */
  next?: Subscriber
  /**
   * 返回 `true` 表示这是一个需要调用 通知的计算结果
   * @internal
  */
  notify(): true | void
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
  target: object
  type: TrackOpTypes | TriggerOpTypes
  key:any
  newValue?: any
  oldValue?: any
  oldTarget?: Map<any, any> | Set<any>
}

export interface ReactiveEffectRunner<T = any> {
  (): T
  effect: ReactiveEffect
}
/******* type 声明 *********/

export type DebuggerEvent = {
  effect: ReactiveEffect;
  target: object;
  type: TrackOpTypes | TriggerOpTypes;
  key: any;
} & DebuggerEventExtraInfo;


/******* 函数声明 **********/

export function isEffect(fn: any): fn is ReactiveEffect {
  return fn && fn._isEffect === true
}

// reactivity 中没有用到这个，给 warning.ts 用
export function pauseTracking(): void {
  trackStack.push(shouldTrack)
  shouldTrack = false
}

export function enableTracking(): void {
  trackStack.push(shouldTrack)
  shouldTrack = true
}

export function resetTracking(): void {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}


export function stop(runner: ReactiveEffectRunner) :void{
  runner.effect.stop()
}

export function batch(sub:Subscriber, isComputed= false):void {
   sub.flags |= EffectFlags.NOTIFIED

   if(isComputed){
    sub.next = batchedComputed // 新节点指向表头
    batchedComputed = sub // 链表更新为新节点
    return
   }

   sub.next= batchedSub // 新节点指的next 指向当前表头
   batchedSub = sub // 链表更新为新节点
}



export class ReactiveEffect<T = any>
  implements Subscriber, ReactiveEffectOptions {
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
  flags: EffectFlags = EffectFlags.ACTIVE | EffectFlags.TRACKING
  /**
   * @internal
   */
  next?: Subscriber = undefined
  /**
   * @internal
   */
  cleanup?: () => void = undefined

  scheduler?: EffectScheduler = undefined
  onStop?: () => void
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

  /**
   * @internal
   */
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
    // TODO cleanupEffect

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
      this.flags  ~EffectFlags.ACTIVE
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

function isDirty(sub: Subscriber): boolean {
  for (let link = sub.deps; link; link = link.nextDep) {
    if (
      link.dep.version !== link.version ||
      (link.dep.computed &&
        (refreshComputed(link.dep.computed) ||
          link.dep.version !== link.version))
    ) {
      return true
    }
  }
  // @ts-expect-error only for backwards compatibility where libs manually set
  // this flag - e.g. Pinia's testing module
  if (sub._dirty) {
    return true
  }
  return false
}


/**
 * Returning false indicates the refresh failed
 * @internal
 */
export function refreshComputed(computed: ComputedRefImpl): undefined {
  if (
    computed.flags & EffectFlags.TRACKING &&
    !(computed.flags & EffectFlags.DIRTY)
  ) {
    return
  }
  computed.flags &= ~EffectFlags.DIRTY

  // Global version fast path when no reactive changes has happened since
  // last refresh.
  if (computed.globalVersion === globalVersion) {
    return
  }
  computed.globalVersion = globalVersion

  // In SSR there will be no render effect, so the computed has no subscriber
  // and therefore tracks no deps, thus we cannot rely on the dirty check.
  // Instead, computed always re-evaluate and relies on the globalVersion
  // fast path above for caching.
  // #12337 if computed has no deps (does not rely on any reactive data) and evaluated,
  // there is no need to re-evaluate.
  if (
    !computed.isSSR &&
    computed.flags & EffectFlags.EVALUATED &&
    ((!computed.deps && !(computed as any)._dirty) || !isDirty(computed))
  ) {
    return
  }
  computed.flags |= EffectFlags.RUNNING

  const dep = computed.dep
  const prevSub = activeSub
  const prevShouldTrack = shouldTrack
  activeSub = computed
  shouldTrack = true

  try {
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


function cleanupDeps(sub: Subscriber) {
  // 清除无用的依赖
  let head
  let tail = sub.depsTail
  let link = tail

  while (link) {
    const prev = link.prevDep
    if (link.version === -1) {
      if (link === tail) tail = prev
      // 无用：移除 deps 订阅的 effect list
      removeSub(link)

      // 同时移除来自这个 effect 的所有依赖
      removeDep(link)
    } else {
      // 新的 head 是最后一个没有从双链表中删除的节点
      head = link
    }

    // 恢复上一个激活的link（如果有）
    link.dep.activeLink = link.prevActiveLink
    link.prevActiveLink = undefined
    link = prev
  }

  // 设置新的 head 和  tail
  sub.deps = head
  sub.depsTail = tail
}
function cleanupEffect(e: ReactiveEffect) {
  const { cleanup } = e
  if (cleanup) {
    // 没有激活的 effect 则被清理
    const prevSub = activeSub
    activeSub = undefined
    try {
      cleanup()
    } finally {
      activeSub = prevSub
    }
  }
}

/**
 * 清除订阅
*/
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
    // 上一个 head 指向下一个订阅
    dep.subsHead = nextSub
  }

  if (dep.subs === link) {
    // 上一个 tail 指向新的 tail
    dep.subs = prevSub

    if (!prevSub && dep.computed) {
      // 如果是已计算，则从所有 deps 中取消订阅，以便垃圾回收
      dep.computed.flags &= ~EffectFlags.TRACKING

      for (let l = dep.computed.deps; l; l = l.nextDep) {
        // 软删，取消订阅，因为计算的内容仍在引用 deps，
        removeSub(l, true)
      }
    }
  }

  // 非软删 而且 dep.sc 计数=0,而且存在 dep.map
  if (!soft && !--dep.sc && dep.map) {
    // #11979

    // dep 属性不再有 effect 订阅者，需要删除
    // 适用于对象保存但只跟踪一次其属性的情况
    dep.map.delete(dep.key)
  }
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