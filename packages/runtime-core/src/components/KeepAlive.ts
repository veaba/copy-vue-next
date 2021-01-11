import { VNode } from '@vue/runtime-core'

export const isKeepAlive = (vnode: VNode): boolean => (vnode.type as any).__isKeepAlive
