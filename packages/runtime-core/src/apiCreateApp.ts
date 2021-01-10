import {ComponentOptions} from "./componentOptions";
import {ConcreteComponent, Data, Component} from "./component";
import {ComponentPublicInstance} from "./componentPublicInstance";
import {NO} from "@vue/shared";
import {Directives} from "./directives";
import {InjectionKey} from "./apiInject";

export type OptionMergeFunction = (
    to: unknown,
    from: unknown,
    instance: any,
    key: string
) => any

export interface AppConfig {
    // @private
    readonly isNativeTag?: (tag: string) => boolean

    performance: boolean
    optionMergeStrategies: Record<string, OptionMergeFunction>
    globalProperties: Record<string, any>
    isCustomElement: (tag: string) => boolean
    errorHandler?: (
        err: unknown,
        instance: ComponentPublicInstance | null,
        info: string
    ) => void
    warnHandler?: (
        msg: string,
        instance: ComponentPublicInstance | null,
        trace: string
    ) => void
}

export interface App<HostElement = any> {
    version: string
    config: AppConfig

    // 内部: 这里需要为 server-renderer 和 devtools 暴露这些内容
    _uid: number
    _component: ConcreteComponent
    _props: Data | null
    _container: HostElement | null
    _context: AppContext

    use(plugin: Plugin, ...options: any[]): this

    mixin(mixin: ComponentOptions): this

    component(name: string): Component | undefined

    component(name: string, component: Component): this

    directive(name: string): Directives | undefined

    directive(name: string, directive: Directives): this

    mount(
        rootContainer: HostElement | string,
        isHydrate: boolean // true 是  SSR
    ): ComponentPublicInstance

    unmount(rootContainer: HostElement | string): void

    provide<T>(key: InjectionKey<T> | string, value: T): this
}

export interface AppContext {
    app: App  // 针对devtools
    config: AppConfig
    mixins: ComponentOptions[]
    components: Record<string, Component>
    directives: Record<string, Directives>
    provides: Record<string | symbol, any>

    /**
     * 取消优化 props 规范化的标志
     * @internal
     * */
    deopt?: boolean

    /**
     * HMR only
     * @internal
     * */
    reload?: () => void

}

// 创建 app 上下文
export function createAppContext(): AppContext {
    return {
        app: null as any,
        config: {
            isNativeTag: NO,
            performance: false,
            globalProperties: {},
            optionMergeStrategies: {},
            isCustomElement: NO,
            errorHandler: undefined,
            warnHandler: undefined
        },
        mixins: [],
        components: {},
        directives: {},
        provides: Object.create(null)
    }
}
