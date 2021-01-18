import { ComponentOptions } from './componentOptions'
import { ConcreteComponent, Data, Component, validateComponentName } from './component'
import { ComponentPublicInstance } from './componentPublicInstance'
import { isFunction, isObject, NO } from '@vue/shared'
import { Directive, Directives, validateDirectiveName } from './directives'
import { InjectionKey } from './apiInject'
import { RootRenderFunction } from './renderer'
import { RootHydrateFunction } from './hydration'
import { warn } from './warning'
import { cloneVNode, createVNode, version, VNode } from './index'
import { devtoolsInitApp, devtoolsUnmountApp } from './devtools'

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

  // 内部: 这里需要为 server-renderer 和 devtools 暴露这些内容
  _uid: number
  _component: ConcreteComponent
  _props: Data | null
  _container: HostElement | null
  _context: AppContext

}

export interface AppContext {
  app: App  // 针对devtools
  config: AppConfig
  mixins: ComponentOptions[]
  components: Record<string, Component>
  directives: Record<string, Directive>
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

type PluginInstallFunction = (app: App, ...options: any[]) => any
export type Plugin = | PluginInstallFunction & {
  install?: PluginInstallFunction
} | {
  install: PluginInstallFunction
}

export type CreateAppFunction<HostElement> = (
  rootComponent: Component,
  rootProps?: Data | null
) => App<HostElement>

let uid = 0

export function createAppAPI<HostElement>(
  render: RootRenderFunction,
  hydrate?: RootHydrateFunction
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent, rootProps = null) {
    if (rootProps != null && !isObject(rootProps)) {
      __DEV__ && warn(`root props passed to app.mount() must be an object.`)
      rootProps = null
    }
    const context = createAppContext()
    const installedPlugins = new Set()

    let isMounted = false
    const app: App = (context.app = {
      _uid: uid++,
      _component: rootComponent as ConcreteComponent,
      _props: rootProps,
      _container: null,
      _context: context,
      version,
      get config() {
        return context.config
      },
      set config(v) {
        if (__DEV__) {
          warn(
            `app.config cannot be replaced. Modify individual options instead.`
          )
        }
      },
      use(plugin: Plugin, ...options: any[]) {
        if (installedPlugins.has(plugin)) {
          // 插件已经被应用到目标应用中。避免重复
          __DEV__ && warn(`Plugin has already been applied to target app.`)
        } else if (plugin && isFunction(plugin.install)) {
          // 两种方式安装
          installedPlugins.add(plugin)
          plugin.install(app, ...options)
        } else if (isFunction(plugin)) {
          installedPlugins.add(plugin)
          plugin(app, ...options)
        } else if (__DEV__) {
          // plugin 必须是一个函数或者带有 `install` 的对象函数
          warn(
            `A plugin must either be a function or an object with an "install" ` +
            `function.`
          )
        }
        return app
      },
      mixin(mixin: ComponentOptions) {
        if (__FEATURE_OPTIONS_API__) {
          if (!context.mixins.includes(mixin)) {
            context.mixins.push(mixin)
            // 全局 mixin 与 props/emits 取消优化 props/emits 规范化缓存。
            if (mixin.props || mixin.emits) {
              context.deopt = true // 罢免
            }
          } else if (__DEV__) {
            warn(
              'Mixin has already been applied to target app' +
              (mixin.name ? `: ${mixin.name}` : '')
            )
          }
        } else if (__DEV__) {
          // Mixins仅在支持Options API的构建中可用。
          warn('Mixins are only available in builds supporting Options API')
        }
        return app
      },

      // 组件
      component(name: string, component?: Component): any {
        if (__DEV__) {
          // 开发环境下，验证组件名称
          validateComponentName(name, context.config)
        }
        if (!component) {
          return context.components[name]
        }
        if (__DEV__ && context.components[name]) {
          // 已注册过
          warn(`Component "${name}" has already been registered in target app.`)
        }
        context.components[name] = component
        return app
      },
      // 指令
      directive(name: string, directive?: Directive) {
        if (__DEV__) {
          // 验证指令名称
          validateDirectiveName(name)
        }
        if (!directive) {
          return context.directives[name] as any
        }
        // 已注册过指令
        if (__DEV__ && context.directives[name]) {
          warn(`Directive "${name}" has already been registered in target app.`)
        }
        context.directives[name] = directive
        return app
      },
      // mount(挂载)
      mount(rootContainer: HostElement, isHydrate?: boolean): any {
        if (!isMounted) {
          const vnode = createVNode(
            rootComponent as ConcreteComponent,
            rootProps
          )
          // 存储 app 上下文在root VNode 上
          // 初始化mount 时在root 实例上设置
          vnode.appContext = context

          // HRM root reload
          if (__DEV__) {
            context.reload = () => {
              render(cloneVNode(vnode), rootContainer)
            }
          }
          if (isHydrate && hydrate) {
            hydrate(vnode as VNode<Node, Element>, rootContainer as any)
          } else {
            render(vnode, rootContainer)
          }
          isMounted = true
          app._container = rootContainer
          // 用于开发工具和遥测
          ;(rootContainer as any).__vue_app__ = app
          if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
            devtoolsInitApp(app, version)
          }
          return vnode.component!.proxy
        } else if (__DEV__) {
          warn(
            `App has already been mounted.\n` +
            `If you want to remount the same app, move your app creation logic ` +
            `into a factory function and create fresh app instances for each ` +
            `mount - e.g. \`const createMyApp = () => createApp(App)\``
          )
        }
      },
      // 卸载
      unmount() {
        if (isMounted) {
          render(null, app._container)
          if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
            devtoolsUnmountApp(app)
          }
        } else if (__DEV__) {
          // 尚未卸载，因为 app 还没有挂载
          warn(`Cannot unmount an app that is not mounted.`)
        }
      },
      provide(key, value) {
        if (__DEV__ && (key as string | symbol) in context.provides) {
          // 重复 provide 值得情况下
          warn(
            `App already provides property with key "${String(key)}". ` +
            `It will be overwritten with the new value.`
          )
        }
        // TypeScript doesn't allow symbols as index type
        // https://github.com/Microsoft/TypeScript/issues/24587
        // TS 不允许 symbols 作为索引类型
        context.provides[key as string] = value
        return app
      }

    })
    return app
  }
}
