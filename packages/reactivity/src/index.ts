export {
    reactive,
    readonly, // 创建响应式只读副本
    isReactive,
    isReadonly,
    isProxy,
    shallowReactive, // TODO: 浅层响应式，什么场景下需要呢？
    shallowReadonly,
    markRaw,
    toRaw,
    ReactiveFlags,
    DeepReadonly
} from "./reactive.js"

// computed
export {
    computed,
    ComputedRef,
    WritableComputedRef,
    WritableComputedOptions,
    ComputedGetter,
    ComputedSetter
} from "./computed.js";

// ref
export {
    ref,
    shallowRef, // 浅层响应式引用
    isRef,
    toRef,
    toRefs,
    unref,
    proxyRefs,
    customRef,
    triggerRef,
    Ref,
    ToRef,
    UnwrapRef,
    ShallowUnwrapRef,
    RefUnwrapBailTypes
} from "./ref.js"

// effect
export {
    effect,
    stop,
    trigger,
    track,
    enableTracking,
    resetTracking,
    ITERATE_KEY,
    ReactiveEffect,
    ReactiveEffectOptions,
    DebuggerEvent
} from "./effect.js"

export { TrackOpTypes, TriggerOpTypes } from './operations.js'
