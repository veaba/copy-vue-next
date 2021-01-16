import { proxyRefs, ReactiveEffect } from '@vue/reactivity'
import {
  applyOptions,
  ComponentOptions,
  ComputedOptions,
  MethodOptions
} from './componentOptions'
import {
  ComponentPropsOptions,
  initProps,
  NormalizedPropsOptions,
  normalizePropsOptions
} from './componentProps'
import {
  emit,
  EmitFn,
  EmitsOptions,
  normalizeEmitsOptions,
  ObjectEmitsOptions
} from './componentEmits'
import { AppContext, createAppContext } from './apiCreateApp'
import { isVNode, VNode, VNodeChild } from './vnode'
import {
  ComponentPublicInstance,
  ComponentPublicInstanceConstructor,
  createRenderContext,
  exposeSetupStateOnRenderContext,
  RuntimeCompiledPublicInstanceProxyHandlers
} from './componentPublicInstance'
import { Directives } from './directives'
import { initSlots, InternalSlots, Slots } from './componentSlots'
import { SuspenseBoundary } from './components/Suspense'
import { EMPTY_OBJ, isFunction, isObject, NOOP } from '@vue/shared'
import { devtoolsComponentAdded } from './devtools'
import { ShapeFlags } from './shapeFlags'
import { warn } from './warning'
import { endMeasure, startMeasure } from './profiling'
import { CompilerOptions } from '../../compile-core/src/options'
import { currentRenderingInstance } from './componentRenderUtils'

const emptyAppContext = createAppContext()
let uid = 0

type LifecycleHook = Function[] | null

export let isInSSRComponentSetup = false

type CompileFunction = (
  template: string | object,
  options?: CompilerOptions
) => InternalRenderFunction

let compile: CompileFunction | undefined

/**
 * 用于拓展 TSX 中组件上允许的非 declared prop
 * */
export interface ComponentCustomProps {
}

export interface ClassComponent {
  new(...args: any[]): ComponentPublicInstance<any, any, any, any, any>

  __vccOpts: ComponentOptions
}

/**
 * TSX 中组件上默认允许 非 declared prop
 * */
export interface AllowedComponentProps {
  class?: unknown
  style?: unknown
}

export const enum LifecycleHooks {
  BEFORE_CREATE = 'bc',
  CREATED = 'c',
  BEFORE_MOUNT = 'bm',
  MOUNTED = 'm',
  BEFORE_UPDATE = 'bu',
  UPDATED = 'u',
  BEFORE_UNMOUNT = 'bum',
  UNMOUNTED = 'um',
  DEACTIVATED = 'da',
  ACTIVATED = 'a',
  RENDER_TRIGGERED = 'rtg',
  RENDER_TRACKED = 'rtc',
  ERROR_CAPTURED = 'ec'
}

export interface SetupContext<E = EmitsOptions, P = Data> {
  props: P
  attrs: Data
  slots: Slots
  emit: EmitFn<E>
  expose: (exposed: Record<string, any>) => void
}

export let currentInstance: ComponentInternalInstance | null = null

export const getCurrentInstance: () => ComponentInternalInstance | null = () =>
  currentInstance || currentRenderingInstance

export const setCurrentInstance = (
  instance: ComponentInternalInstance | null
) => {
  currentInstance = instance
}

/**
 * @internal
 * */
export type InternalRenderFunction = {
  (
    ctx: ComponentPublicInstance,
    cache: ComponentInternalInstance['renderCache'],
    // 对于 compiler-optimized bindings
    $props: ComponentInternalInstance['props'],
    $setup: ComponentInternalInstance['setupState'],
    $data: ComponentInternalInstance['data'],
    $options: ComponentInternalInstance['ctx']
  ): VNodeChild
  _rc?: boolean // isRuntimeCompiled
}

export type Data = Record<string, unknown>

// 提示：不能将这整个接口标记为内部接口，因为一些公共接口扩展了它。
export interface ComponentInternalOptions {
  /**
   * @internal
   * */
  __props?: NormalizedPropsOptions
  /**
   * @internal
   * */
  __emits?: ObjectEmitsOptions | null
  /**
   * @internal
   * */
  __scopeId?: string
  /**
   * @internal
   * */
  __cssModules?: Data
  /**
   * @internal
   * */
  __hmrId?: string
  /**
   * 这个应该公开，以便devtools可以使用它
   * */
  __file?: string
}

export interface FunctionalComponent<P = {}, E extends EmitsOptions = {}>
  extends ComponentInternalOptions {
  // 这里使用 `any` 是有目的的，所以它可以成为有效的 JSX element 构造函数
  (props: P, ctx: Omit<SetupContext<E, P>, 'expose'>): any

  props?: ComponentPropsOptions<P>
  emits?: E | (keyof E)[]
  inheritAttrs?: boolean
  displayName?: string
}

/**
 *
 * */
export type ConcreteComponent<Props = {},
  RawBindings = any,
  D = any,
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions> =
  | ComponentOptions<Props, RawBindings, D, C, M>
  | FunctionalComponent<Props, any>

/**
 * 我们暴露了内部实例上的一个 property 子集，因为它们对高阶外部库和工具很有用
 * */
export interface ComponentInternalInstance {
  uid: number
  type: ConcreteComponent
  parent: ComponentInternalInstance | null
  root: ComponentInternalInstance
  appContext: AppContext
  /**
   * vNode: 表示该组件在其父级 vDom 树中的位置
   * */
  vnode: VNode

  /**
   * 等待新的 vNode 从父级中更新
   * @internal
   * */
  next: VNode | null
  /**
   * 该组件子集的vdom树的 根 vnode
   * */
  subTree: VNode
  /**
   * 用于渲染和修补组件的响应式 effect。可调用。
   * */
  update: ReactiveEffect
  /**
   * 返回 vdom 树的渲染函数
   * @internal
   * */
  render: InternalRenderFunction | null
  /**
   * SSR render function
   * @internal
   * */
  ssrRender?: Function | null
  /**
   * 包含该组件为其子代提供的值得对象
   * @internal
   * */
  provides: Data
  /**
   * 追踪与该组件相关的响应式 effect (如：watchers)，以便在组件 unmount 时自动停止
   * @internal
   * */
  effects: ReactiveEffect[] | null
  /**
   * proxy 访问类型的缓存，以避免调用 hasOwnProperty
   * @internal
   * */
  accessCache: Data | null
  /**
   * 缓存依赖在 `_ctx` 的渲染函数值，但在出世后不需要更新(例如：内联的 handlers)
   * @internal
   * */
  renderCache: (Function | VNode)[]
  /**
   * 解决组件注册，仅适用于带有 mixins 或 extends 的组件。
   * @internal
   * */
  components: Record<string, ConcreteComponent> | null
  /**
   * 解决指令注册，仅适用于带有 mixins 或 extends 的组件。
   * @internal
   * */
  directives: Record<string, Directives> | null
  /**
   * 解决 props options
   * */
  propsOptions: NormalizedPropsOptions
  /**
   * 解决 emits options
   * */
  emitsOptions: ObjectEmitsOptions | null

  // 其他的只针对有状态的组件 ------------------------------

  // 作为公共实例上的主proxy (`this`)
  proxy: ComponentPublicInstance | null

  // 通过 expose() 暴露属性
  exposed: Record<string, any> | null

  /**
   * 替代 proxy, 仅用于使用 `with` 块的运行时编译的渲染函数
   * @internal
   * */
  withProxy: ComponentPublicInstance | null

  /**
   * 这是公共实例 proxy 的目标，它还持有由用户选项(计算属性，method 等等)注入的property和用户附加的自定义property(通过 `this.x= ...`)
   * @internal
   * */
  ctx: Data

  // state
  data: Data
  props: Data
  attrs: Data
  slots: InternalSlots
  refs: Data
  emit: EmitFn
  /**
   * 用于跟踪组件上的 `.once` 事件 handlers
   * @internal
   * */
  emitted: Record<string, boolean> | null
  /**
   * setup 相关
   * @internal
   * */
  setupState: Data
  /**
   * devtools 访问其他信息
   * @internal
   * */
  devtoolsRawSetupState?: any
  /**
   * @internal
   * */
  setupContext: SetupContext | null

  /**
   * suspense 相关
   * */
  suspense: SuspenseBoundary | null
  /**
   * suspense 等待 batch id
   * @internal
   * */
  suspenseId: number
  /**
   * @internal
   * */
  asyncDep: Promise<any> | null

  /**
   * @internal
   * */
  asyncResolved: boolean

  // lifecycle
  isMounted: boolean
  isUnmounted: boolean
  isDeactivated: boolean

  // 生命周期 ------------------------------
  /**
   * lifecycle: before create
   * @internal
   * */
  [LifecycleHooks.BEFORE_CREATE]: LifecycleHook
  /**
   * lifecycle: created
   * @internal
   * */
  [LifecycleHooks.CREATED]: LifecycleHook
  /**
   * lifecycle: before mount
   * @internal
   * */
  [LifecycleHooks.BEFORE_MOUNT]: LifecycleHook
  /**
   * lifecycle: mounted
   * @internal
   * */
  [LifecycleHooks.MOUNTED]: LifecycleHook
  /**
   * lifecycle: before update
   * @internal
   * */
  [LifecycleHooks.BEFORE_UPDATE]: LifecycleHook
  /**
   * lifecycle: updated
   * @internal
   * */
  [LifecycleHooks.UPDATED]: LifecycleHook
  /**
   * lifecycle: before unmount
   * @internal
   * */
  [LifecycleHooks.BEFORE_UNMOUNT]: LifecycleHook
  /**
   * lifecycle: unmounted
   * @internal
   * */
  [LifecycleHooks.UNMOUNTED]: LifecycleHook
  /**
   * lifecycle: render tracked
   * @internal
   * */
  [LifecycleHooks.RENDER_TRACKED]: LifecycleHook
  /**
   * lifecycle: render triggered
   * @internal
   * */
  [LifecycleHooks.RENDER_TRIGGERED]: LifecycleHook
  /**
   * lifecycle: ACTIVATED
   * @internal
   * */
  [LifecycleHooks.ACTIVATED]: LifecycleHook
  /**
   * lifecycle: Deactivated
   * @internal
   * */
  [LifecycleHooks.DEACTIVATED]: LifecycleHook
  /**
   * lifecycle: error Captured
   * @internal
   * */
  [LifecycleHooks.ERROR_CAPTURED]: LifecycleHook
}

/**
 * 在公共API中使用的一种类型，在这里预期有一个组件类型。
 * 构造函数类型是由 defineComponent() 返回的一个人工类型。
 *
 * */
export type Component<Props = any,
  RawBindings = any,
  D = any,
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions> =
  | ConcreteComponent<Props, RawBindings, D, C, M>
  | ComponentPublicInstanceConstructor<Props>

/**
 * 创建组件实例
 * */
export function createComponentInstance(
  vnode: VNode,
  parent: ComponentInternalInstance | null,
  suspense: SuspenseBoundary | null
) {
  const type = vnode.type as ConcreteComponent
  // 继承父级应用上下文, 或者 如果是根级，则从根节点采用
  const appContext =
    (parent ? parent.appContext : vnode.appContext) || emptyAppContext

  const instance: ComponentInternalInstance = {
    uid: uid++,
    vnode,
    type,
    parent,
    appContext,
    root: null!, // to be immediately set
    next: null,
    subTree: null!, // 将在创建后同步设置
    update: null!, // 将在创建后同步设置
    render: null,
    proxy: null,
    exposed: null,
    withProxy: null,
    effects: null,
    provides: parent ? parent.provides : Object.create(appContext.provides),
    accessCache: null!,
    renderCache: [],

    // local resolved assets
    components: null,
    directives: null,

    // resolved props and emits options
    propsOptions: normalizePropsOptions(type, appContext),
    emitsOptions: normalizeEmitsOptions(type, appContext),

    // emit
    emit: null as any, // 将立即设置
    emitted: null,

    // state
    ctx: EMPTY_OBJ,
    data: EMPTY_OBJ,
    props: EMPTY_OBJ,
    attrs: EMPTY_OBJ,
    slots: EMPTY_OBJ,
    refs: EMPTY_OBJ,
    setupState: EMPTY_OBJ,
    setupContext: null,

    // suspense related
    suspense,
    suspenseId: suspense ? suspense.pendingId : 0,
    asyncDep: null,
    asyncResolved: false,

    // lifecycle hooks
    // 在这里不使用枚举，因为它会影响计算属性结果
    isMounted: false,
    isUnmounted: false,
    isDeactivated: false,
    bc: null,
    c: null,
    bm: null,
    m: null,
    bu: null,
    u: null,
    um: null,
    bum: null,
    da: null,
    a: null,
    rtg: null,
    rtc: null,
    ec: null
  }

  if (__DEV__) {
    instance.ctx = createRenderContext(instance)
  } else {
    instance.ctx = { _: instance }
  }
  instance.root = parent ? parent.root : instance
  instance.emit = emit.bind(null, instance)
  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    devtoolsComponentAdded(instance)
  }

  return instance
}

export function recordInstanceBoundEffect(effect: ReactiveEffect) {
  if (currentInstance) {
    ;(currentInstance.effects || (currentInstance.effects = [])).push(effect)
  }
}

const classifyRE = /(?:^|[-_])(\w)/g
const classify = (str: string): string =>
  str.replace(classifyRE, c => c.toUpperCase()).replace(/[-_]/g, '')

/* istanbul ignore next */
export function formatComponentName(
  instance: ComponentInternalInstance | null,
  Component: ConcreteComponent,
  isRoot = false
): string {
  let name = isFunction(Component)
    ? Component.displayName || Component.name
    : Component.name
  if (!name && Component.__file) {
    const match = Component.__file.match(/([^/\\]+)\.vue$/)
    if (match) {
      name = match[1]
    }
  }

  if (!name && instance && instance.parent) {
    // 尝试根据反向解析推断名称
    const inferFormRegistry = (registry: Record<string, any> | undefined) => {
      for (const key in registry) {
        if (!registry.hasOwnProperty(key)) continue
        if (registry[key] === Component) {
          return key
        }
      }
    }
    name =
      inferFormRegistry(
        instance.components ||
        (instance.parent.type as ComponentOptions).components
      ) || inferFormRegistry(instance.appContext.components)
  }
  return name ? classify(name) : isRoot ? `App` : `Anonymous`
}

export function setupComponent(
  instance: ComponentInternalInstance,
  isSSR = false
) {
  isInSSRComponentSetup = isSSR
  const { props, children, shapeFlag } = instance.vnode
  const isStateful = shapeFlag & ShapeFlags.STATEFUL_COMPONENT
  initProps(instance, props, isStateful, isSSR)
  initSlots(instance, children)
}

export function isClassComponent(value: unknown): value is ClassComponent {
  return isFunction(value) && '__vccOpts' in value
}

function finishComponentSetup(
  instance: ComponentInternalInstance,
  isSSR: boolean
) {
  const Component = instance.type as ComponentOptions

  // template / render  function 规范化
  if (__NODE_JS__ && isSSR) {
    if (Component.render) {
      instance.render = Component.render as InternalRenderFunction
    }
  } else if (!instance.render) {
    // 可以通过setup() 设置
    if (compile && Component.template && !Component.render) {
      if (__DEV__) {
        startMeasure(instance, `compile`)
      }
      Component.render = compile(Component.template, {
        isCustomElement: instance.appContext.config.isCustomElement,
        delimiters: Component.delimiters
      })
      if (__DEV__) {
        endMeasure(instance, `compile`)
      }
    }
    instance.render = (Component.render || NOOP) as InternalRenderFunction
    // 对于使用 "with "块的运行时编译渲染函数，渲染
    // 使用的代理需要一个不同的 "has "处理程序，它的性能更强，而且。
    // 也只允许白名单的globals落空。

    if (instance.render._rc) {
      instance.withProxy = new Proxy(
        instance.ctx,
        RuntimeCompiledPublicInstanceProxyHandlers
      )
    }
  }

  // 支持 2.x  options
  if (__FEATURE_OPTIONS_API__) {
    currentInstance = instance
    applyOptions(instance, Component)
    currentInstance = null
  }

  // 警告丢失 template/render
  if (__DEV__ && !Component.render && instance.render === NOOP) {
    /* istanbul ignore if */
    if (!compile && Component.template) {
      warn(
        `Component provided template option but ` +
        `runtime compilation is not supported in this build of Vue.` +
        (__ESM_BUNDLER__
          ? ` Configure your bundler to alias "vue" to "vue/dist/vue.esm-bundler.js".`
          : __ESM_BROWSER__
            ? ` Use "vue.esm-browser.js" instead.`
            : __GLOBAL__
              ? ` Use "vue.global.js" instead.`
              : ``) /* should not happen */
      )
    } else {
      warn(`Component is missing template or render function.`)
    }
  }
}

export function handleSetupResult(
  instance: ComponentInternalInstance,
  setupResult: unknown,
  isSSR: boolean
) {
  if (isFunction(setupResult)) {
    // setup 返回行内render function
    if (!__BROWSER__ && (instance.type as ComponentOptions).__ssrInlineRender) {
      // 当函数名称为`ssrRender`时（由SFC内联模式编译）。
      // 将其设置为ssrRender。
      instance.ssrRender = setupResult
    } else {
      instance.render = setupResult as InternalRenderFunction
    }
  } else if (isObject(setupResult)) {
    if (__DEV__ && isVNode(setupResult)) {
      warn(
        `setup() should not return VNodes directly - ` +
        `return a render function instead.`
      )
    }
    //设置返回的绑定。
    // 假设存在一个从模板编译的渲染函数。
    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      instance.devtoolsRawSetupState = setupResult
    }
    instance.setupState = proxyRefs(setupResult)
    if (__DEV__) {
      exposeSetupStateOnRenderContext(instance)
    }
  } else if (__DEV__ && setupResult !== undefined) {
    warn(
      `setup() should return an object. Received: ${
        setupResult === null ? 'null' : typeof setupResult
      }`
    )
  }
  finishComponentSetup(instance, isSSR)
}

/**
 * runtime-dom 注册 compiler
 * 注意导出的方法使用任何，以避免 d.ts 依赖编译器类型。
 * */
export function registerRuntimeCompiler(_compile: any) {
  compile = _compile
}
