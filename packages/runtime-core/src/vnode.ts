import {ReactiveFlags, Ref} from "@vue/reactivity";
import {ComponentInternalInstance} from "./component";
import {RendererElement, RendererNode} from "./renderer";
import {DirectiveBinding} from "./directives";
import {TransitionHooks} from "./BaseTransition";
import {SuspenseBoundary} from "./suspense";
import {AppContext} from "./apiCreateApp";
import {RawSlots} from "./componentSlots";


type VNodeMountHook = (vnode: VNode) => void
type VNodeUpdateHook = (vnode: VNode, oldVNode: VNode) => void
type VNodeChildAtom = | VNode | string | number | boolean | null | undefined | void

export type VNodeTypes = {}
export type VNodeHook = | VNodeMountHook | VNodeUpdateHook | VNodeMountHook[] | VNodeUpdateHook[]
export type VNodeArrayChildren = Array<VNodeArrayChildren | VNodeChildAtom>
export type VNodeChild = VNodeChildAtom | VNodeArrayChildren
export type VNodeRef = | string | Ref | ((ref: object | null, refs: Record<string, any>) => void)
export type VNodeProps = {
    key?: string | number
    ref?: VNodeRef

    // vnode hooks
    onVnodeBeforeMount?: VNodeMountHook | VNodeMountHook[]
    onVnodeMounted?: VNodeMountHook | VNodeMountHook[]
    onVnodeBeforeUpdate?: VNodeUpdateHook | VNodeUpdateHook[]
    onVnodeUpdated?: VNodeUpdateHook | VNodeUpdateHook[]
    onVnodeBeforeUnmount?: VNodeMountHook | VNodeMountHook[]
    onVnodeUnmounted?: VNodeMountHook | VNodeMountHook[]
}

export type VNodeNormalizedRefAtom = {
    i: ComponentInternalInstance,
    r: VNodeRef
}
export type VNodeNormalizedRef = | VNodeNormalizedRefAtom | (VNodeNormalizedRefAtom)[]
export type VNodeNormalizedChildren = string | VNodeArrayChildren | RawSlots | null

export interface VNode<HostNode = RendererNode,
    HostElement = RendererElement,
    ExtraProps = { [key: string]: any }> {
    /**
     * @internal
     * */
    __v_isVNode: true
    /**
     * @internal
     * */
    [ReactiveFlags.SKIP]: true
    type: VNodeTypes
    props: (VNodeProps & ExtraProps) | null
    key: string | number | null
    ref: VNodeNormalizedRef | null
    scopeId: string | null // SFC only
    children: VNodeNormalizedChildren
    component: ComponentInternalInstance | null
    dirs: DirectiveBinding[] | null
    transition: TransitionHooks<HostElement> | null

    // DOM
    el: HostNode | null
    anchor: HostNode | null // fragment anchor（片段锚）
    target: HostElement | null // teleport target (vue 3 新特性)
    targetAnchor: HostNode | null // teleport target anchor
    staticCount: number // 静态 vNode 中包含的元素数理

    // suspense： 新特性，允许挂载一些错误的信息，异步组件解析时显示后备内容
    suspense: SuspenseBoundary | null
    ssContent: VNode | null
    ssFallback: VNode | null

    // 仅用于优化
    shapeFlag: number
    patchFlag: number
    dynamicProps: string[] | null
    dynamicChildren: VNode[] | null

    // 仅用于应用的根节点
    appContext: AppContext | null
}
