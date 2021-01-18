import {
  createRenderer,
  VNode,
  RootRendererFunction,
  CreateAppFunction
} from '@vue/runtime-core'

import { nodeOps, TestElement } from './nodeOps'
import { patchProp } from './patchProp'
import { serializeInner } from './serialize'
import { extend } from '@vue/shared'

const { render: baseRender, createApp: baseCreateApp } = createRenderer(
  extend({ patchProp }, nodeOps)
)
export const render = baseRender as RootRendererFunction
export const createApp = baseCreateApp as CreateAppFunction<TestElement>

// 方便一次性渲染验证
export function renderToString(vnode: VNode) {
  const root = nodeOps.createElement('div')
  render(vnode, root)
  return serializeInner(root)
}

export * from './triggerEvent'
export * from './serialize'
export * from './nodeOps'
export * from '@vue/runtime-core'
