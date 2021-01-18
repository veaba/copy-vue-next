import { extend } from '@vue/shared'
import {
  ClassComponent,
  ComponentInternalInstance,
  ConcreteComponent,
  InternalRenderFunction,
  isClassComponent
} from './component'
import { ComponentOptions, ComputedOptions } from './componentOptions'
import { queueJob, queuePostFlushCb } from './scheduler'

export let isHmrUpdating = false

type HMRRecord = {
  component: ComputedOptions
  instance: Set<ComponentInternalInstance>
}
const map: Map<string, HMRRecord> = new Map()

function createRecord(
  id: string,
  component: ComputedOptions | ClassComponent
): boolean {
  if (map.has(id)) {
    return false
  }

  map.set(id, {
    component: isClassComponent(component) ? component.__vccOpts : component,
    instance: new Set()
  })
  return true
}

export function registerHMR(instance: ComponentInternalInstance) {
  const id = instance.type.__hmrId!
  let record = map.get(id)
  if (!record) {
    createRecord(id, instance.type as ComponentOptions)
    record = map.get(id)!
  }
  record.instance.add(instance)
}

export function unregisterHMR(instance: ComponentInternalInstance) {
  map.get(instance.type.__hmrId!)!.instance.delete(instance)
}

function rerender(id: string, newRender?: Function) {
  const record = map.get(id)
  if (!record) return
  // Array.from 创建了一个快照，避免了更新过程中Set的变更
  Array.from(record.instance).forEach(instance => {
    if (newRender) {
      instance.render = newRender as InternalRenderFunction
    }
    instance.renderCache = []
    // 该标志强制带有槽内容的子组件更新
    isHmrUpdating = true
    instance.update()
    isHmrUpdating = false
  })
}

function reload(id: string, newComp: ComponentOptions | ClassComponent) {
  const record = map.get(id)
  if (!record) return
  // Array.from创建了一个快照，避免了更新过程中 set 的变更。
  const { component, instance } = record

  if (!hmrDirtyComponents.has(component)) {
    // 1. 更新现有的编译定义，使之与新的定义相匹配。
    newComp = isClassComponent(newComp) ? newComp.__vccOpts : newComp
    extend(component, newComp)

    for (const key in component) {
      if (!(key in newComp)) {
        delete (component as any)[key]
      }
    }

    // 2. 标记组件 ditry。这将迫使渲染器在打补丁时更换组件。
    hmrDirtyComponents.add(component)

    // 3. reload 后一定要取消组件的标记。
    queuePostFlushCb(() => {
      hmrDirtyComponents.delete(component)
    })
  }

  Array.from(instance).forEach(instance => {
    if (instance.parent) {
      // 4. 强制父级实例重新渲染。这将导致所有更新后的组件被取消挂载并重新挂载。排队更新，这样我们就不会强迫同一个父体重新渲染多次。
      queueJob(instance.parent.update)
    } else if (instance.appContext.reload) {
      // 通过 createApp() 挂载的根实例有一个重载方法。
      instance.appContext.reload()
    } else if (typeof window !== 'undefined') {
      // 通过raw render()创建的树内的根实例。强制重载。
      window.location.reload()
    } else {
      console.warn(
        '[HMR] Root or manually mounted instance modified. Full reload required.'
      )
    }
  })
}

export interface HMRRuntime {
  createRecord: typeof createRecord
  rerender: typeof rerender
  reload: typeof reload
}

export const hmrDirtyComponents = new Set<ConcreteComponent>()
