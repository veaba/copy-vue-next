/********************* Core API **********************/


export const version = __VERSION__

// 响应式系统核心
export {
  // core
  reactive,
  ref,
  readonly,
  // 基础公共库
  unref,
  proxyRefs,
  isRef,
  toRef,
  toRefs,
  isProxy,
  isReactive,
  isReadonly,
  // 高阶
  customRef,
  triggerRef,
  shallowRef,
  shallowReactive,
  shallowReadonly,
  markRaw,
  toRaw
} from '@vue/reactivity'

export { computed } from './apiComputed' // 计算属性 API
export { watch, watchEffect } from './apiWatch'

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
  onErrorCaptured
} from './apiLifecycle'
export { provide, inject } from './apiInject'
export { nextTick } from './scheduler'
export { defineComponent } from './apiDefineComponent'
export { defineAsyncComponent } from './apiAsyncComponent'
export { defineOptions } from './apiDefineOptions'

// 高阶 API ----------------------------------------------------------------

// 用于在setup（）中获取内部实例-对于高级
// plugins (插件)
export { getCurrentInstance } from './components'

// 针对 raw render function 用户
export { h } from './h'
// 高阶 render function 工具库
export { createVNode, cloneVNode, mergeProps, isVNode } from './vnode'
// VNode types
export { Fragment, Text, Comment, Static } from './vnode'
// 内置 components
export { Teleport, TeleportProps } from './components/Teleport'
export { Suspense, SuspenseProps } from './components/Suspense'
export { KeepAlive, KeepAliveProps } from './components/KeepAlive'
export {
  BaseTransition,
  BaseTransitionProps
} from './components/BaseTransition'
// 用于用户自定义指令
export { withDirectives } from './directives'
// SSR context
export { useSSRContext, ssrContextKey } from './helpers/useSSRContext'

//**************** 自定义 Renderer API
export { createRenderer, createHydrationRenderer } from './renderer'
export { queuePostFlushCb } from './scheduler'
export { warn } from './warning'
export {
  handleError,
  callWithErrorHandling,
  callWithAsyncErrorHandling,
  ErrorCodes
} from './errorHanding'

export {
  resolveComponent,
  resolveDirective,
  resolveDynamicComponent
} from './helpers/resolveAssets'
// 用于集成 与运行时编译器
export { registerRuntimeCompiler } from './component'
export {} from './components/BaseTransition'
export { initCustomFormatter } from './customFormatter'

// 用于 devtools
export { devtools, setDevtoolsHook } from './devtools'

//**************** Types 类型
import { VNode } from './vnode'
import { ComponentInternalInstance } from './component'

declare module '@vue/reactivity' {
  export interface RefUnwrapBailTypes {
    runtimeCoreBailTypes:
      | VNode
      | {
      // 直接对ComponentPublicInstance执行bailing操作会导致递归
      // so we use this as a bail hint
      $: ComponentInternalInstance
    }
  }
}

export {
  ReactiveEffect,
  ReactiveEffectOptions,
  DebuggerEvent,
  TrackOpTypes,
  TriggerOpTypes,
  Ref,
  ComputedRef,
  WritableComputedRef,
  UnwrapRef,
  ShallowUnwrapRef,
  WritableComputedOptions,
  ToRef,
  DeepReadonly
} from '@vue/reactivity'

export {
  WatchEffect,
  WatchOptions,
  WatchOptionsBase,
  WatchCallback,
  WatchSource,
  WatchStopHandle
} from './apiWatch'
export { InjectionKey } from './apiInject'
export {
  App,
  AppConfig,
  AppContext,
  Plugin,
  CreateAppFunction,
  OptionMergeFunction
} from './apiCreateApp'
export {
  VNode,
  VNodeChild,
  VNodeTypes,
  VNodeProps,
  VNodeArrayChildren,
  VNodeNormalizedChildren
} from './vnode'
export {
  Component,
  ConcreteComponent,
  FunctionalComponent,
  ComponentInternalInstance,
  SetupContext,
  ComponentCustomProps,
  AllowedComponentProps
} from './component'
export { DefineComponent } from './apiDefineComponent'
export {
  ComponentOptions,
  ComponentOptionsMixin,
  ComponentOptionsWithoutProps,
  ComponentOptionsWithArrayProps,
  ComponentOptionsWithObjectProps,
  ComponentCustomOptions,
  ComponentOptionsBase,
  RenderFunction,
  MethodOptions,
  ComputedOptions
} from './componentOptions'

export {
  EmitsOptions, ObjectEmitsOptions
} from './componentEmits'
export {
  ComponentPublicInstance,
  ComponentCustomProperties
} from './componentPublicInstance'
export {
  Renderer,
  RendererNode,
  RendererElement,
  HydrationRenderer,
  RendererOptions,
  RootRendererFunction
} from './renderer'
export { RootHydrateFunction } from './hydration'
export { Slot, Slots } from './componentSlots'
export {
  Prop,
  PropType,
  ComponentPropsOptions,
  ComponentObjectPropsOptions,
  ExtractPropTypes,
  ExtractDefaultPropTypes
} from './componentProps'
export {
  Directive,
  DirectiveBinding,
  DirectiveHook,
  ObjectDirective,
  FunctionDirective,
  DirectiveArguments
} from './directives'
export { SuspenseBoundary } from './components/Suspense'
export { TransitionState, TransitionHooks } from './components/BaseTransition'
export { AsyncComponentOptions, AsyncComponentLoader } from './apiAsyncComponent'
export { HMRRuntime } from './hmr'
//**************** Internal API 内部API
// **重要**内部API在不同版本之间可能会在没有通知的情况下发生变化，用户代码应避免依赖它们。

// 用于 compiler 生成 code
// 应该同步 '@vue/compiler-core/src/runtimeConstants.ts'
export { withCtx } from './helpers/withRenderContext'
export { renderList } from './helpers/renderList'
export { toHandlers } from './helpers/toHandlers'
export { renderSlot } from './helpers/renderSlot'
export { createSlots } from './helpers/createSlots'
export { pushScopeId, popScopeId, withScopeId } from './helpers/scopeId'
export {
  openBlock,
  createBlock,
  setBlockTracking,
  createTextVNode,
  createCommentVNode,
  createStaticVNode
} from './vnode'
export {
  toDisplayString,
  camelize,
  capitalize,
  toHandlerKey
} from '@vue/shared'
// 用于 test-utils
export { transformVNodeArgs } from './vnode'

// **************** SSR

// 这些API只对@vue/server-renderer暴露，不同版本之间可能会发生变化，恕不另行通知。用户代码永远不应该依赖它们。
import { createComponentInstance, setupComponent } from './component'
import { renderComponentRoot, setCurrentRenderingInstance } from './componentRenderUtils'

import { isVNode, normalizeVNode } from './vnode'

const _ssrUtils = {
  createComponentInstance,
  setupComponent,
  renderComponentRoot,
  setCurrentRenderingInstance,
  isVNode,
  normalizeVNode
}

/**
 * SSR utils for \@vue/server-renderer. Only exposed in cjs builds.
 * @internal
 * */
export const ssrUtils = (__NODE_JS__ ? _ssrUtils : null) as typeof _ssrUtils
