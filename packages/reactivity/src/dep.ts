import { extend, isArray, isIntegerKey, isMap, isSymbol } from '@vue/shared'
import type { ComputedRefImpl } from './computed'
import { type TrackOpTypes, TriggerOpTypes } from './constants'
import {
  type DebuggerEventExtraInfo,
  EffectFlags,
  type Subscriber,
  activeSub,
  endBatch,
  shouldTrack,
  startBatch,
} from './effect'

/**
 * Incremented every time a reactive change happens
 * This is used to give computed a fast path to avoid re-compute when nothing
 * has changed.
 */
export let globalVersion = 0


// The main WeakMap that stores {target -> key -> dep} connections.
// Conceptually, it's easier to think of a dependency as a Dep class
// which maintains a Set of subscribers, but we simply store them as
// raw Maps to reduce memory overhead.
type KeyToDepMap = Map<any, Dep>

/**
 * @internal
*/
export class Dep {
  version: number = 0

  /**
   * link 此  dep 和 当前激活的 effect
  */
  activeLink?: Link = undefined

  /**
   * 订阅 effect 的双链表（尾部）
  */
  subs?: Link = undefined

  /**
   * 订阅 effect 的双链表（头节点）
   * 仅开发者使用，用于按照正确顺序调用 onTrigger 钩子
  */
  subsHead?: Link = undefined

  /**
   * 对象属性依赖清理
   * 
  */
  map?: KeyToDepMap = undefined

  key?: unknown = undefined

  /**
   * 订阅者计数
  */
  sc: number = 0

  /**
   * @internal
   */
  readonly __v_skip?: boolean = true

  constructor(public computed?: ComputedRefImpl | undefined) {
    if (__DEV__) {
      this.subsHead = undefined
    }
  }

  track(debugInfo?: DebuggerEventExtraInfo): Link | undefined {
    // 没有订阅者、不需要追踪、激活的订阅者等于 computed ？
    if (!activeSub || !shouldTrack || activeSub === this.computed) {
      return
    }

    let link = this.activeLink

    // TODO  理解为没link，重新 link 起来
    if (link === undefined || link.sub !== activeSub) {
      link = this.activeLink = new Link(activeSub, this)


      // 添加这 link 到 activeEffect 作为一个 dep（作为 tail）
      if (!activeSub.deps) {
        activeSub.deps = activeSub.depsTail = link
      } else {
        link.prevDep = activeSub.depsTail // 新 link 前指针指向链表尾部
        activeSub.depsTail!.nextDep = link // 当前尾部节点后指针指向新 link
        activeSub.depsTail = link // 更新链表尾部为 新 link
      }

      addSub(link)
    } else if (link.version === -1) {
      // 从上一次允许中回收 - 已经是 sub，只需同步版本
      link.version = this.version

      // 如果该 dep 有下一个依赖项，
      // 则表示它不在尾部，将其移动到尾部。
      // 这确保了 effect 的依赖项列表在评估过程中按访问顺序排列。
      if (link.nextDep) {
        const next = link.nextDep
        next.prevDep = link.prevDep

        if (link.prevDep) {
          link.prevDep.nextDep = next
        }

        link.prevDep = activeSub.depsTail
        link.nextDep = undefined
        activeSub.depsTail!.nextDep = link
        activeSub.depsTail = link

        // 重新调整指针的头
        if (activeSub.deps === link) {
          activeSub.deps = next
        }
      }
    }

    if (__DEV__ && activeSub.onTrack) {
      activeSub.onTrack(
        extend(
          {
            effect: activeSub,
          },
          debugInfo
        ),
      )
    }
    return link
  }

  trigger(debugInfo?: DebuggerEventExtraInfo): void {
    this.version++
    globalVersion++
    this.notify(debugInfo)
  }

  notify(debugInfo?: DebuggerEventExtraInfo): void{
    
  }
}

/**
 * @internal
*/
export class Link {

  /**
   * 在每一次 effect 运行之前，version 会被重置为 -1
   * - 运行过程中，link 的 version 在访问时与 源依赖保持同步
   * - 运行结束后，版本仍未 -1 （从未被使用过） 的 link 将会被清理
  */
  version: number

  /**
   * 双向链表的指针操作
  */
  nextDep?: Link
  prevDep?: Link
  nextSub?: Link
  prevSub?: Link
  prevActiveLink?: Link

  constructor(
    public sub: Subscriber,
    public dep: Dep
  ) {
    this.version = dep.version
    this.nextDep =
      this.prevDep =
      this.nextSub =
      this.prevSub =
      this.prevActiveLink =
      undefined
  }
}

function addSub(link: Link) { 
  link.dep.sc++

  if(link.sub.flags & EffectFlags.TRACKING){
    const computed = link.dep.computed

    // 计算属性获得第一个订阅者
    // 启用追踪+懒加载订阅所有依赖
    if(computed && !link.dep.subs){
      computed.flags |= EffectFlags.TRACKING | EffectFlags.DIRTY
      for(let l = computed.deps; l; l = l.nextDep){
        addSub(l)
      }
    }

    const currentTail = link.dep.subs
    if(currentTail !== link){
      link.prevSub = currentTail
    
      if(currentTail) currentTail.nextSub = link
    } 

    if(__DEV__ && link.dep.subsHead=== undefined){
      link.dep.subsHead = link
    }

    link.dep.subs = link
  }
}
