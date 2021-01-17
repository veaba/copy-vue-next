import {
  camelize,
  capitalize,
  ComponentOptions,
  ConcreteComponent,
  Directive,
  FunctionalComponent,
  VNodeTypes
} from '@vue/runtime-core'
import { isString } from '@vue/shared'
import { currentRenderingInstance } from '../componentRenderUtils'
import { currentInstance } from '../component'
import { warn } from '../warning'

export const NULL_DYNAMIC_COMPONENT = Symbol()

function resolve(registry: Record<string, any> | undefined, name: string) {
  return (
    registry &&
    (registry[name] ||
      registry[camelize(name)] ||
      registry[capitalize(camelize(name))]
    )
  )
}

const COMPONENTS = 'components'
const DIRECTIVES = 'directives'

/**
 * @private
 * overload 1:components
 * */
function resolveAsset(
  type: typeof COMPONENTS, // QA: 直接
  name: string,
  warnMissing?: boolean
): ConcreteComponent | undefined

// overload 2: directives
function resolveAsset(
  type: typeof DIRECTIVES,
  name: string
): Directive | undefined

// resolveAsset 实现
function resolveAsset(
  type: typeof COMPONENTS | typeof DIRECTIVES,
  name: string,
  warnMissing = true
) {
  const instance = currentRenderingInstance || currentInstance
  if (instance) {
    const Component = instance.type

    // 自名具有最高优先级
    if (type === COMPONENTS) {
      const selfName = (Component as FunctionalComponent).displayName || Component.name
      if (selfName && (selfName === name) ||
        selfName === camelize(name) ||
        selfName === capitalize(camelize(name))) {
        return Component
      }
    }
    const res =
      // local registration
      // 首先检查 instance[type] 中是否有包含 mixin 或 extends 的组件。
      resolve(instance[type] || (Component as ComponentOptions)[type], name) ||
      // global registration
      resolve(instance.appContext[type], name)
    if (__DEV__ && warnMissing && !res) {
      warn(`Failed to resolve ${type.slice(0, -1)}: ${name}`)
    }
    return res
  } else if (__DEV__) {
    warn(
      `resolve${capitalize(type.slice(0, -1))} ` +
      `can only be used in render() or setup().`
    )
  }
}

/**
 * @private
 * */
export function resolveComponent(name: string): ConcreteComponent | string {
  return resolveAsset(COMPONENTS, name) || name
}

/**
 * @private
 * */
export function resolveDirective(name: string): Directive | undefined {
  return resolveAsset(DIRECTIVES, name)
}

/**
 * @private
 * */
export function resolveDynamicComponent(component: unknown): VNodeTypes {
  if (isString(component)) {
    //  无效类型将通过 createVNode 并发出警告
    return resolveAsset(COMPONENTS, component, false) || component
  } else {
    return (component || NULL_DYNAMIC_COMPONENT) as any
  }
}
