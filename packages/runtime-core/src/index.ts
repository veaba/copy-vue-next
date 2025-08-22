export { createRenderer, createHydrationRenderer } from './renderer'
export { defineComponent } from './apiDefineComponent'

export { nextTick } from './scheduler'

export {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  onActivated,
  onDeactivated,
  onRenderTracked,
  onRenderTriggered,
  onErrorCaptured,
  onServerPrefetch,
} from './apiLifecycle'

// For raw render function users
export { h } from './h'