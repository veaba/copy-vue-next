import { ComponentPublicInstance } from './componentPublicInstance'
import { isArray } from '@vue/shared'


export interface SchedulerJob {
  (): void,

  /**
   * 唯一 job id, 只出现在原始 effects 上，例如组件渲染 effect。
   */
  id?: number,
  /**
   * 1. 表示是否允许job 自己递归触发
   * 2. 默认情况下，job不能自行触发，因为一些内置的方法调用，例如 Array.prototype.push
   * 实际上也会执行读取(#1740)，这会导致混乱的无限循环。
   * 3. 允许的情况是组件更新函数的侦听回调
   * 4. 组件更新函数可以更新子 组件 prop，进而触发 flush，`pre` 侦听回调，以改变父级所依赖的状态 (#1801)
   * 5. Watch 回调不会跟踪它的依赖关系，所以如果它再次触发自己，很可能是有目的的。
   * 用户有必要执行递归状态改变，直至最终固定下来(#1727).
   */
  allowRecurse?: boolean
}

let currentFlushPromise: Promise<void> | null = null
let isFlushing = false
let isFlushPending = false
const resolvedPromise: Promise<any> = Promise.resolve()
let activePreFlushCbs: SchedulerCb[] | null = null
const pendingPreFlushCbs: SchedulerCb[] = []
let preFlushIndex = 0

let pendingPostFlushCbs: SchedulerCb[] = []
let activePostFlushCbs: SchedulerCb[] | null = null
let postFlushIndex = 0

export type SchedulerCb = Function & { id?: number }
export type SchedulerCbs = SchedulerCb | SchedulerCb[]
type CountMap = Map<SchedulerJob | SchedulerCb, number>

const RECURSION_LIMIT = 100 //循环限制

const queue: SchedulerJob[] = []
let flushIndex = 0
let currentPreFlushParentJob: SchedulerJob | null = null

export function nextTick(
  this: ComponentPublicInstance | void,
  fn?: () => void
): Promise<void> {
  const p = currentFlushPromise || resolvedPromise
  return fn ? p.then(this ? fn.bind(this) : fn) : p
}

function flushJobs(seen?: CountMap) {
  isFlushPending = false
  isFlushing = true
  if (__DEV__) {
    seen = seen || new Map()
  }
}

function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true
    currentFlushPromise = resolvedPromise.then(flushJobs)
  }
}

export function invalidateJob(job: SchedulerJob) {
  const i = queue.indexOf(job)
  if (i > -1) {
    queue.slice(i, 1)
  }
}

export function queueJob(job: SchedulerJob) {
  // dedupe 搜索使用 `Array.includes()` 的startIndex参数，默认情况下，搜索 index 包括当前正在运行的job，所以它不能再递归地触发自己。
  // 如果 job 是一个 watch() 回调，搜索将从+1索引开始，以允许它递归地触发自己--这是用户自己的责任，以确保它不会最终陷入一个无限循环。
  if ((!queue.length || !queue.includes(job, isFlushing && job.allowRecurse ? flushIndex + 1 : flushIndex)) && job !== currentPreFlushParentJob) {
    queue.push(job)
    queueFlush() // 队列刷新
  }
}

function queueCb(
  cb: SchedulerCbs,
  activeQueue: SchedulerCb[] | null,
  pendingQueue: SchedulerCb[],
  index: number
) {
  if (!isArray(cb)) {
    if (!activeQueue || !activeQueue.includes(cb, (cb as SchedulerJob).allowRecurse ? index + 1 : index)) {
      pendingQueue.push(cb)
    }
  } else {
    // 如果 cb 是一个数组，它是一个组件生命周期钩子，只能由一个job触发，而这个job
    // 已经在主队列中重复了，所以我们可以在这里跳过重复检查，以提高性能。
    pendingQueue.push(...cb)
  }
}

export function queuePreFlushCb(cb: SchedulerCb) {
  queueCb(cb, activePreFlushCbs, pendingPreFlushCbs, preFlushIndex)
}

export function queuePostFlushCb(cb: SchedulerCbs) {
  queueCb(cb, activePostFlushCbs, pendingPostFlushCbs, postFlushIndex)
}

const getId = (job: SchedulerJob | SchedulerCb) => job.id == null ? Infinity : job.id

function checkRecursiveUpdates(seen: CountMap, fn: SchedulerJob | SchedulerCb) {
  if (!seen.has(fn)) {
    seen.set(fn, 1)
  } else {
    const count = seen.get(fn)!
    if (count > RECURSION_LIMIT) {
      throw new Error(
        `Maximum recursive updates exceeded. ` +
        `This means you have a reactive effect that is mutating its own ` +
        `dependencies and thus recursively triggering itself. Possible sources ` +
        `include component template, render function, updated hook or ` +
        `watcher source function.`
      )
    } else {
      seen.set(fn, count + 1)
    }
  }
}

export function flushPostFlushCbs(seen?: CountMap) {
  if (pendingPostFlushCbs.length) {
    const deduped = [...new Set(pendingPostFlushCbs)]
    pendingPostFlushCbs.length = 0

    // #1947 已有激活队列，嵌套flushPostFlushCbs调用。
    if (activePostFlushCbs) {
      activePostFlushCbs.push(...deduped)
      return
    }
    activePostFlushCbs = deduped
    if (__DEV__) {
      seen = seen || new Map()
    }

    activePostFlushCbs.sort((a, b) => getId(a) - getId(b))
    for (
      postFlushIndex = 0;
      postFlushIndex < activePostFlushCbs.length;
      postFlushIndex++
    ) {
      if (__DEV__) {
        checkRecursiveUpdates(seen!, activePostFlushCbs[postFlushIndex])
      }
      activePostFlushCbs[postFlushIndex]()
    }
    activePostFlushCbs = null
    postFlushIndex = 0
  }
}

export function flushPreFlushCbs(
  seen?: CountMap,
  parentJob: SchedulerJob | null = null
) {
  if (pendingPreFlushCbs.length) {
    currentPreFlushParentJob = parentJob
    activePreFlushCbs = [...new Set(pendingPreFlushCbs)]
    pendingPreFlushCbs.length = 0
    if (__DEV__) {
      seen = seen || new Map()
    }
    for (
      preFlushIndex = 0;
      preFlushIndex < activePreFlushCbs.length;
      preFlushIndex++
    ) {
      if (__DEV__) {
        checkRecursiveUpdates(seen!, activePreFlushCbs[preFlushIndex])
      }
      activePreFlushCbs[preFlushIndex]()
    }
    activePreFlushCbs = null
    preFlushIndex = 0
    currentPreFlushParentJob = null
    // 递归知道冲洗
    flushPreFlushCbs(seen, parentJob)
  }
}
