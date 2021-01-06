import {VNode} from "./vnode";


export type Slot = (...args: any[])=>VNode[]
export type InternalSlots ={
    [name: string]:Slot|undefined
}
export type Slots =Readonly<InternalSlots>
