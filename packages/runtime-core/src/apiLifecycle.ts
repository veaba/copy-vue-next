import { DebuggerEvent } from '@vue/reactivity'
import { ComponentInternalInstance, currentInstance, isInSSRComponentSetup, LifecycleHooks } from './component'


export type ErrorCapturedHook = (
  err: unknown,
  instance: ComponentInternalInstance | null,
  info: string
) => boolean | void


export const createHook = <T extends Function = () => any>(
  lifecycle: LifecycleHooks
) => (hook: T, target: ComponentInternalInstance | null = currentInstance) => !isInSSRComponentSetup && injectHook(lifecycle, hook, target)

export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT)
export const onMounted = createHook(LifecycleHooks.MOUNTED)
export const onBeforeUpdate = createHook(LifecycleHooks.BEFORE_UPDATE)
export const onUpdated = createHook(LifecycleHooks.UPDATED)
export const onBeforeUnmount = createHook(LifecycleHooks.BEFORE_UNMOUNT)
export const onUnmounted = createHook(LifecycleHooks.UNMOUNTED)

export type DebuggerHook = (e: DebuggerEvent) => void
export const onRenderTracked = createHook<DebuggerHook>(
  LifecycleHooks.RENDER_TRACKED
)
export const onRenderTriggered = createHook<DebuggerHook>(
  LifecycleHooks.RENDER_TRIGGERED
)

// keepalive hook
export function onActivated(
  hook: Function,
  target?: ComponentInternalInstance | null
) {
  registerKeepAliveHook(hook, LifecycleHooks.ACTIVATED, target)
}

// keepalive remove hook
export function onDeactivated(
  hook: Function,
  target?: ComponentInternalInstance | null
) {
  registerKeepAliveHook(hook, LifecycleHooks.DEACTIVATED, target)
}

export const onErrorCaptured = (
  hook: Function,
  target: ComponentInternalInstance | null = currentInstance
) => {
  injectHook(LifecycleHooks.ERROR_CAPTURED, hook, target)
}
