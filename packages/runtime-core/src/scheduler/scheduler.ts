import {ComponentPublicInstance} from "../componentPublicInstance";


export interface SchedulerJob {
    (): void,

    /**
     * 唯一 job id, 只出现在原始 effects 上，例如组件渲染 effect。
     */
    id?: number,
    /**
     * Indicates whether the job is allowed to recursively trigger itself.
     * By default, a job cannot trigger itself because some built-in method calls,
     * e.g. Array.prototype.push actually performs reads as well (#1740) which
     * can lead to confusing infinite loops.
     * The allowed cases are component update functions and watch callbacks.
     * Component update functions may update child component props, which in turn
     * trigger flush: "pre" watch callbacks that mutates state that the parent
     * relies on (#1801). Watch callbacks doesn't track its dependencies so if it
     * triggers itself again, it's likely intentional and it is the user's
     * responsibility to perform recursive state mutation that eventually
     * stabilizes (#1727).
     */
    allowRecurse?: boolean
}

let currentFlushPromise: Promise<void> | null = null
let isFlushing = false
let isFlushPending = false
const resolvedPromise: Promise<any> = Promise.resolve()

export type SchedulerCb = Function & { id?: number }
export type SchedulerCbS = SchedulerCb | SchedulerCb[]
type CountMap = Map<SchedulerJob | SchedulerCb, number>

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

export function queueJob(job: SchedulerJob) {
    // dedupe 搜索使用 `Array.includes()` 的startIndex参数，默认情况下，搜索 index 包括当前正在运行的job，所以它不能再递归地触发自己。
    // 如果 job 是一个 watch() 回调，搜索将从+1索引开始，以允许它递归地触发自己--这是用户自己的责任，以确保它不会最终陷入一个无限循环。
    if ((!queue.length || !queue.includes(job, isFlushing && job.allowRecurse ? flushIndex + 1 : flushIndex)) && job !== currentPreFlushParentJob) {
        queue.push(job)
        queueFlush() // 队列刷新
    }
}

