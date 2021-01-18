import { currentInstance } from './component'
import { currentRenderingInstance } from './componentRenderUtils'
import { isFunction } from '@vue/shared'
import { warn } from './warning'

export interface InjectionKey<T> extends Symbol {
}

export function provide<T>(key: InjectionKey<T> | string, value: T) {
  if (!currentInstance) {
    if (__DEV__) {
      warn(`provide() can only be used inside setup().`)
    }
  } else {
    let provides = currentInstance.provides
    // 默认情况下，一个实例继承了其父级的provide对象，但当它需要提供自己的值时，
    // 它会使用父体的provide对象作为原型创建自己的provide对象。
    // 这样一来，在`inject`中，我们可以简单地从直接父类中查找注入，让原型链来完成工作。
    const parentProvides = currentInstance.parent && currentInstance.parent.provides
    if (parentProvides === provides) {
      provides = currentInstance.provides = Object.create(parentProvides)
    }
    // TS不允许将符号作为索引类型
    provides[key as string] = value
  }
}

export function inject<T>(key: InjectionKey<T> | string): T | undefined

export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T,
  treatDefaultAsFactory?: false
): T

export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T | (() => T),
  treatDefaultAsFactory: true
): T
export function inject(
  key: InjectionKey<any> | string,
  defaultValue?: unknown,
  treatDefaultAsFactory = false
) {
  // fallback 到 "currentRenderingInstance"，以便在功能组件中调用。
  const instance = currentInstance || currentRenderingInstance
  if (instance) {
    // #2400
    // 以支持 `app.use` plugins
    // 如果实例在根目录下，则 fallback 到 appContext 的 "provides"。
    const provides =
      instance.parent == null
        ? instance.vnode.appContext && instance.vnode.appContext.provides
        : instance.parent.provides
    if (provides && (key as string | symbol) in provides) {
      // TS不允许将符号作为索引类型
      return provides[key as string]
    } else if (arguments.length > 1) {
      return treatDefaultAsFactory && isFunction(defaultValue)
        ? defaultValue()
        : defaultValue
    } else if (__DEV__) {
      warn(`injection "${String(key)}" not found.`)
    }
  } else if (__DEV__) {
    // inject() 只能在 setup() 或函数性组件中使用。
    warn(`inject() can only be used inside setup() or functional components.`)
  }
}
