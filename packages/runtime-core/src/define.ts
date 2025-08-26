import { VNodeProps } from "./type"

export const COMPONENTS = 'components'
export const DIRECTIVES = 'directives'
export const FILTERS = 'filters'


export const NULL_DYNAMIC_COMPONENT: unique symbol = Symbol.for('v-ndc')
export const ssrContextKey: unique symbol = Symbol.for('v-scx')
export const Text: unique symbol = Symbol.for('v-txt')
export const Comment: unique symbol = Symbol.for('v-cmt')
export const Static: unique symbol = Symbol.for('v-stc')
export const Fragment = Symbol.for('v-fgt') as any as {
  __isFragment: true
  new(): {
    $props: VNodeProps
  }
}
export const compatModelEventPrefix = `onModelCompat:`
export const TeleportEndKey: unique symbol = Symbol('_vte')
export const leaveCbKey: unique symbol = Symbol('_leaveCb')
export let isHmrUpdating = false
