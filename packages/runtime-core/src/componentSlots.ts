import {VNode} from "./vnode";
import {ComponentInternalInstance} from "./component";
import {SlotFlags} from "../../shared/src/slotFlags";


export type Slot = (...args: any[]) => VNode[]
export type InternalSlots = {
    [name: string]: Slot | undefined
}
export type Slots = Readonly<InternalSlots>

export type RawSlots = {
    [name: string]: unknown

    // 手动渲染 fn 提示跳过强制 children 更新
    $stable?: boolean
    /**
     * 用于跟踪 slot 主实例。当组件 vnode 被创建时，在 normalizeChildren 期间会附加这个。
     * @internal
     * */
    _ctx?: ComponentInternalInstance | null
    /**
     * 表示编译器生成的 slots 我们使用保留属性而不是 vnode patchFlag，
     * 因为 slots 对象可能会在手动渲染函数中直接传递给子组件，而优化提示需要在 slot 对象本身上被保留。
     * @internal
     * */
    _?: SlotFlags

}
