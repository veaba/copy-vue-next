import {ReactiveEffect} from "@vue/reactivity";
import {ComponentOptions, ComponentPropsOptions, ComputedOptions, MethodOptions,} from "./componentOptions";
import {NormalizedPropsOptions, normalizePropsOptions} from "./componentProps";
import {EmitFn, EmitsOptions, normalizeEmitsOptions, ObjectEmitsOptions} from "./componentEmits";
import {AppContext} from "./apiCreateApp";
import {VNode, VNodeChild} from "./vnode";
import {ComponentPublicInstance, createRenderContext} from "./componentPublicInstance";
import {Directive} from "./directive";
import {InternalSlots, Slots} from "./componentSlots";
import {SuspenseBoundary} from "./Suspense";
import {EMPTY_OBJ} from "@vue/shared";

const emptyAppcontext = createAppContext()
let uid = 0

type LifecycleHook = Function[] | null

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

// TODO 提示：不能将这整个接口标记为内部接口，因为一些公共接口扩展了它。
export interface ComponentInternalOptions {
    /**
     * @internal
     * */
    __props?: NormalizedPropsOptions
    ///
}

export interface FunctionalComponent<P = {}, E extends EmitsOptions = {}>
    extends ComponentInternalOptions {
    // 这里使用 `any` 是有目的的，所以它可以成为有效的 JSX element 构造函数
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
    uid: number,
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
    directives: Record<string, Directive> | null
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
 * 创建组件实例
 * */
export function createComponentInstance(
    vnode: VNode,
    parent: ComponentInternalInstance | null,
    suspense: SuspenseBoundary | null
) {
    const type = vnode.type as ConcreteComponent
    // 继承父级应用上下文, 或者 如果是根级，则从根节点采用
    const appContext = (parent ? parent.appContext : vnode.appContext) || emptyAppcontext

    const instance: ComponentInternalInstance = {
        uid: uid++,
        vnode,
        type,
        parent,
        appContext,
        root: null!,// TODO: to be immediately set
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
        instance.ctx = {_: instance}
    }
    instance.root = parent ? parent.root : instance
    instance.emit = emit.bind(null, instance)
    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        devtoolsComponentAdded(instance)
    }

    return instance
}

export let currentInstance: ComponentInternalInstance | null = null;

export function recordInstanceBoundEffect(effect: ReactiveEffect) {
    if (currentInstance) {

    }
}