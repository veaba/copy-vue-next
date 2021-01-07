import {pauseTracking, resetTracking} from '@vue/reactivity'
import {callWithErrorHandling, ErrorCodes} from "./errorHanding";
import {VNode} from "./vnode";


const stack: VNode[] = []

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
