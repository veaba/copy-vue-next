import {isRef, pauseTracking, resetTracking, toRaw} from '@vue/reactivity'
import {callWithErrorHandling, ErrorCodes} from "./errorHandling";
import {VNode} from "./vnode";
import {ComponentInternalInstance, ConcreteComponent, Data, formatComponentName} from "./component";
import {isFunction, isString} from "@vue/shared";


const stack: VNode[] = []
type ComponentVNode = VNode & { type: ConcreteComponent }
type TraceEntry = {
    vnode: ComponentVNode
    recurseCount: number
}
type ComponentTraceStack = TraceEntry[]

function getComponentTrace(): ComponentTraceStack {
    let currentVNode: VNode | null = stack[stack.length - 1]
    if (!currentVNode) {
        return []
    }

    // 我们不能只使用堆栈，因为在不是从根开始的更新过程中，堆栈将是不完整的。使用实例父指针重新构造父链。
    const normalizedStack: ComponentTraceStack = []
    while (currentVNode) {
        const last = normalizedStack[0]
        if (last && last.vnode === currentVNode) {
            last.recurseCount++
        } else {
            normalizedStack.push({
                vnode: currentVNode as ComponentVNode,
                recurseCount: 0
            })
        }
        const parentInstance: ComponentInternalInstance | null =
            currentVNode.component && currentVNode.component.parent
        currentVNode = parentInstance && parentInstance.vnode
    }
    return normalizedStack
}

/* istanbul ignore next */
function formatTrace(trace: ComponentTraceStack): any[] {
    const logs: any[] = []
    trace.forEach((entry, i) => {
        logs.push(...(i === 0 ? [] : [`\n`]), ...formatTraceEntry(entry))
    })
    return logs
}


function formatProp(key: string, value: unknown): any[]
function formatProp(key: string, value: unknown, raw: true): any
/* istanbul ignore next */
function formatProp(key: string, value: unknown, raw?: boolean): any {
    if (isString(value)) {
        value = JSON.stringify(value)
        return raw ? value : [`${key}=${value}`]
    } else if (
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value == null
    ) {
        return raw ? value : [`${key}=${value}`]
    } else if (isRef(value)) {
        value = formatProp(key, toRaw(value.value), true)
        return raw ? value : [`${key}=Ref<`, value, `>`]
    } else if (isFunction(value)) {
        return [`${key}=fn${value.name ? `<${value.name}>` : ``}`]
    } else {
        value = toRaw(value)
        return raw ? value : [`${key}=`, value]
    }
}

/* istanbul ignore next */
function formatProps(props: Data): any[] {
    const res: any[] = []
    const keys = Object.keys(props)
    keys.slice(0, 3).forEach((key) => {
        res.push(...formatProp(key, props[key]))
    })
    if (keys.length > 3) {
        res.push(` ...`)
    }
    return res
}

function formatTraceEntry({vnode, recurseCount}: TraceEntry): any[] {
    const postfix =
        recurseCount > 0 ? `...(${recurseCount} recursive calls)` : ``
    const isRoot = vnode.component ? vnode.component.parent == null : false
    const open = `at <${formatComponentName(
        vnode.component,
        vnode.type,
        isRoot
    )}`
    const close = `>` + postfix
    return vnode.props
        ? [open, ...formatProps(vnode.props), close]
        : [open + close]
}

export function warn(msg: string, ...args: any[]) {
    // 避免 prop 格式化或警告处理程序跟踪deps可能在补丁期间发生改变，导致无限递归。
    pauseTracking()

    const instance = stack.length ? stack[stack.length - 1].component : null;
    const appWarnHandler = instance && instance.appContext.config.warnHandler
    const trace = getComponentTrace()

    if (appWarnHandler) {
        callWithErrorHandling(
            appWarnHandler,
            instance,
            ErrorCodes.APP_WARN_HANDLER,
            [
                msg + args.join(''),
                instance && instance.proxy,
                trace.map(({vnode}) => `at <${formatComponentName(instance, vnode.type)}>`).join('\n'),
                trace
            ]
        )
    } else {
        const warnArgs = [`[Vue warn]: ${msg}`, ...args]
        /* istanbul ignore if */
        if (trace.length && !__TEST__) {
            warnArgs.push(`\n`, ...formatTrace(trace))
        }
        console.warn(...warnArgs)
    }
    resetTracking()
}

export function pushWarningContext(vnode: VNode) {
    stack.push(vnode)
}

export function popWarningContext() {
    stack.pop()
}
