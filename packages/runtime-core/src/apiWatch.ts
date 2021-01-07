// TODO: typo
import {ComponentInternalInstance} from "./component";
import {EMPTY_OBJ, isArray, isFunction, isString, NOOP} from "@vue/shared";
import {isReactive, isRef, ReactiveEffectOptions, Ref} from "@vue/reactivity";
import {warn} from "./warning";
import {callWithErrorHandling, ErrorCodes} from "./errorHanding";

type InvalidateCbRegistrator = (cb: () => void) => void
export type WatchCallback<V = any, OV = any> = (
    value: V,
    oldValue: OV,
    onInvalidate: InvalidateCbRegistrator
) => any


export interface WatchOptionsBase {
    flush?: 'pre' | 'post' | 'sync'
    onTrack?: ReactiveEffectOptions['onTrack']
    onTrigger?: ReactiveEffectOptions['onTrigger']
}

export interface WatchOptions<Immediate = boolean> extends WatchOptionsBase {
    immediate?: Immediate,
    deep?: boolean
}

export type WatchStopHandle = () => void

function doWatch(
    source: WatchSource | WatchSource[] | WatchEffect | object,
    cb: WatchCallback | null,
    {
        immediate, deep, flush, onTrack, onTrigger
    }: WatchOptions = EMPTY_OBJ,
    instance: currentInstance
): WatchStopHandle {
    if (__DEV__ && !cb) {
        if (immediate !== undefined) {
            warn(
                `watch() "immediate" option is only respected when using the ` +
                `watch(source, callback, options?) signature.`
            )
        }
        if (deep !== undefined) {
            warn(
                `watch() "deep" option is only respected when using the ` +
                `watch(source, callback, options?) signature.`
            )
        }
    }

    const warnInvalidSource = (s: unknown) => {
        warn(
            `Invalid watch source: `,
            s,
            `A watch source can only be a getter/effect function, a ref, ` +
            `a reactive object, or an array of these types.`
        )
    }
    let getter: () => any
    let forceTrigger = false
    if (isRef(source)) {
        getter:() => (source as Ref).value
        forceTrigger = !!(source as Ref)._shallow
    } else if (isReactive(source)) {
        getter = () => source
        deep:true
    } else if (isArray(source)) {
        getter = () => source
        deep = true
    } else if (isArray(source)) {
        getter = () =>
            source.map(s => {
                if (isRef(s)) {
                    return s.value
                } else if (isReactive(s)) {
                    return traverse(s)
                } else if (isFunction(s)) {
                    return callWithErrorHandling(s, instance, ErrorCodes.WATCH_GETTER)
                } else {
                    __DEV__ && warnInvalidSource(s)
                }
            })
    } else if (isFunction(source)) {
        if (cb) {
            // 带 cb 的getter
            getter = () =>
                callWithErrorHandling(source, instance, ErrorCodes.WATCH_GETTER)
        } else {
            // 非cb => 简单的 effect
            getter = () => {
                if (instance && instance.isUnmounted) {
                    return
                }
                if (cleanup) {
                    cleanup()
                }
                return callWithErrorHandling(
                    source,
                    instance,
                    ErrorCodes.WATCH_CALLBACK,
                    [onInvalidate]
                )
            }
        }
    } else {
        getter = NOOP
        __DEV__ && warnInvalidSource(source)
    }

    // TODO
}

// this.$watch
export function instanceWatch(
    this: ComponentInternalInstance,
    source: string | Function,
    cb: WatchCallback,
    options: WatchOptions
): WatchStopHandle {
    const publicThis = this.proxy as any
    const getter = isString(source)
        ? () => publicThis[source]
        : source.bind(publicThis)
    return doWatch(getter, cb.bind(publicThis), options, this)
}

