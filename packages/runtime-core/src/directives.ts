import {VNode} from "./vnode";
import {ComponentPublicInstance} from "./componentPublicInstance";
import {Data} from "./component";


export type DirectiveModifier = Record<string, boolean>
export type Directive<T = any, V = any> = ObjectDirective<T, V> | FunctionDirective<T, V>

export interface DirectiveBinding<V = any> {
    instance: ComponentPublicInstance | null
    value: V
    oldValue: V | null
    arg?: string
    modifier: DirectiveModifier
    dir: ObjectDirective<any, V>
}

export type DirectiveHook<T = any, Prev = VNode<any, T> | null, V = any> = (
    el: T,
    binding: DirectiveBinding<V>,
    vnode: VNode<any, T>,
    prevNode: Prev
) => void
export type FunctionDirective<T = any, V = any> = DirectiveHook<T, any, V>

export type SSRDirectiveHook = (
    binding: DirectiveBinding,
    vnode: VNode
) => Data | undefined

export interface ObjectDirective<T = any, V = any> {
    created?: DirectiveHook<T, null, V>
    beforeMount?: DirectiveHook<T, null, V>
    mounted?: DirectiveHook<T, null, V>
    beforeUpdate?: DirectiveHook<T, VNode<any, T>, V>
    updated?: DirectiveHook<T, null, V>
    beforeUnmount?: DirectiveHook<T, null, V>
    unmounted?: DirectiveHook<T, null, V>
    getSSRProps?: SSRDirectiveHook
}

export type Directives<T = any, V = any> =
    | ObjectDirective<T, V>
    | FunctionDirective<T, V>
