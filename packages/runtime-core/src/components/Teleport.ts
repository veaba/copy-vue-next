import {
  ComponentInternalInstance,
  RendererElement,
  RendererNode, RendererOptions,
  SuspenseBoundary, VNode, VNodeArrayChildren,
  VNodeProps
} from '@vue/runtime-core'
import { warn } from '@vue/runtime-core'
import { ShapeFlags } from '../shapeFlags'
import { MoveType, RendererInternals, traverseStaticChildren } from '../renderer'
import { isString } from '@vue/shared'

export const isTeleport = (type: any): boolean => type.__isTeleport

export interface TeleportProps {
  to: string | RendererElement | null | undefined
  disabled?: boolean
}

export type TeleportVNode = VNode<RendererNode, RendererElement, TeleportProps>

export const enum TeleportMoveTypes {
  TARGET_CHANGE,
  TOGGLE, // enable / disable
  REORDER // moved in the main view
}

export const isTeleportDisabled = (props: VNode['props']): boolean =>
  props && (props.disabled || props.disabled === '')

const resolveTarget = <T = RendererElement>(
  props: TeleportProps | null,
  select: RendererOptions['querySelector']
): T | null => {
  const targetSelector = props && props.to
  if (isString(targetSelector)) {
    if (!select) {
      __DEV__ &&
      warn(
        `Current renderer does not support string target for Teleports. ` +
        `(missing querySelector renderer option)`
      )
      return null
    } else {
      const target = select(targetSelector)
      if (!target) {
        __DEV__ &&
        warn(
          `Failed to locate Teleport target with selector "${targetSelector}". ` +
          `Note the target element must exist before the component is mounted - ` +
          `i.e. the target cannot be rendered by the component itself, and ` +
          `ideally should be outside of the entire Vue component tree.`
        )
      }
      return target as any
    }
  } else {
    if (__DEV__ && !targetSelector && !isTeleportDisabled(props)) {
      warn(`Invalid Teleport target: ${targetSelector}`)
    }
    return targetSelector as any
  }
}

interface TeleportTargetElement extends Element {
  // last teleport target
  _lpa?: Node | null
}

function moveTeleport(
  vnode: VNode,
  container: RendererElement,
  parentAnchor: RendererNode | null,
  { o: { insert }, m: move }: RendererInternals,
  moveType: TeleportMoveTypes = TeleportMoveTypes.REORDER
) {
  // move target anchor if this is a target change
  if (moveType === TeleportMoveTypes.TARGET_CHANGE) {
    insert(vnode.targetAnchor!, container, parentAnchor)
  }
  const { el, anchor, shapeFlag, children, props } = vnode
  const isRecorder = moveType === TeleportMoveTypes.REORDER
  // 如果重新排序，则移动主视图 anchor
  if (isRecorder) {
    insert(el!, container, parentAnchor)
  }

  // 如果这是一次重新排序，并且启用了传送功能（内容在目标中）。
  // 不要移动孩子。因此，相反的是：只有当这个
  // 不是重新排序，或者禁止 teleport。
  if (!isRecorder || isTeleportDisabled(props)) {
    // Teleport要么有Array children，要么没有 children。
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      for (let i = 0; i < (children as VNode[]).length; i++) {
        move(
          (children as VNode[])[i],
          container,
          parentAnchor,
          MoveType.REORDER
        )
      }
    }
  }

  // 如果重新排序，则移动主视图 anchor
  if (isRecorder) {
    insert(anchor!, container, parentAnchor)
  }
}

function hydrateTeleport(
  node: Node,
  vnode: TeleportVNode,
  parentComponent: ComponentInternalInstance | null,
  parentSuspense: SuspenseBoundary | null,
  optimized: boolean,
  {
    o: { nextSibling, parentNode, querySelector }
  }: RendererInternals<Node, Element>,
  hydrateChildren: (
    node: Node | null,
    vnode: VNode,
    container: Element,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    optimized: boolean
  ) => Node | null
): Node | null {
  const target = (vnode.target = resolveTarget<Element>(
    vnode.props,
    querySelector
  ))
  if (target) {
    // 如果多个远距传输呈现在同一个目标元素上，我们就需要
    // 从最后一次传送完成的地方接上，而不是从第一个节点接上。
    const targetNode = (target as TeleportTargetElement)._lpa || target.firstChild
    if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      if (isTeleportDisabled(vnode.props)) {
        vnode.anchor = hydrateChildren(
          nextSibling(node),
          vnode,
          parentNode(node)!,
          parentComponent,
          parentSuspense,
          optimized
        )
        vnode.targetAnchor = targetNode
      } else {
        vnode.anchor = nextSibling(node)
        vnode.targetAnchor = hydrateChildren(
          targetNode,
          vnode,
          target,
          parentComponent,
          parentSuspense,
          optimized
        )
      }
      ;(target as TeleportTargetElement)._lpa = vnode.targetAnchor && nextSibling(vnode.targetAnchor as Node)
    }
  }
  return vnode.anchor && nextSibling(vnode.anchor as Node)
}

export const TeleportImpl = {
  __isTeleport: true,
  process(
    n1: TeleportVNode | null,
    n2: TeleportVNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    isSVG: boolean,
    optimized: boolean,
    internals: RendererInternals
  ) {
    const {
      mc: mountChildren,
      pc: patchChildren,
      pbc: patchBlockChildren,
      o: { insert, querySelector, createText, createComment }
    } = internals

    const disabled = isTeleportDisabled(n2.props)
    const { shapeFlag, children } = n2
    if (n1 == null) {
      // insert anchors 在 主 view
      const placeholder = (n2.el = __DEV__ ? createComment('teleport start') : createText(''))
      const mainAnchor = (n2.anchor = __DEV__ ? createComment('teleport end') : createText(''))
      insert(placeholder, container, anchor)
      insert(mainAnchor, container, anchor)

      const target = (n2.target = resolveTarget(n2.props, querySelector))
      const targetAnchor = (n2.targetAnchor = createText(''))
      if (target) {
        insert(targetAnchor, target)
      } else if (__DEV__ && !disabled) {
        warn(`Invalid Teleport target on mount:`, target, `(${typeof target})`)
      }
      const mount = (container: RendererElement, anchor: RendererNode) => {
        // Teleport 总是有数组children,这一点在一下两个方法面都得到加强
        // compile 和 vnode children 规范化
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(
            children as VNodeArrayChildren,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            optimized
          )
        }
      }

      if (disabled) {
        mount(container, mainAnchor)
      } else if (target) {
        mount(target, targetAnchor)
      }
    } else {
      // 更新 content
      n2.el = n1.el
      const mainAnchor = (n2.anchor = n1.anchor)!
      const target = (n2.target = n1.target)!
      const targetAnchor = (n2.targetAnchor = n1.targetAnchor)!
      const wasDisabled = isTeleportDisabled(n1.props)
      const currentContainer = wasDisabled ? container : target
      const currentAnchor = wasDisabled ? mainAnchor : targetAnchor

      if (n2.dynamicChildren) {
        // fast path when the teleport happens to be a block root
        patchBlockChildren(
          n1.dynamicChildren!,
          n2.dynamicChildren,
          currentContainer,
          parentComponent,
          parentSuspense,
          isSVG
        )
        // 即使在块树模式下，我们也需要确保所有的根级节点
        // 在远距 teleport 中继承以前的DOM引用，这样他们可以
        // 在未来的补丁中被移动。
        traverseStaticChildren(n1, n2, true)
      } else if (!optimized) {
        patchChildren(
          n1,
          n2,
          currentContainer,
          currentAnchor,
          parentComponent,
          parentSuspense,
          isSVG
        )
      }
      if (disabled) {
        if (!wasDisabled) {
          // enabled -> disabled
          // 移到主容器中
          moveTeleport(
            n2,
            container,
            mainAnchor,
            internals,
            TeleportMoveTypes.TOGGLE
          )
        }
      } else {
        // 目标改变
        if ((n2.props && n2.props.to) !== (n1.props && n1.props.to)) {
          const nextTarget = (n2.target = resolveTarget(
            n2.props,
            querySelector
          ))
          if (nextTarget) {
            moveTeleport(
              n2,
              nextTarget,
              null,
              internals,
              TeleportMoveTypes.TARGET_CHANGE
            )
          } else if (__DEV__) {
            warn(
              `Invalid Teleport target on update:`,
              target,
              `(${typeof target})`
            )
          }
        } else if (wasDisabled) {
          // disabled -> enabled
          // move 到 teleport target
          moveTeleport(
            n2,
            target,
            targetAnchor,
            internals,
            TeleportMoveTypes.TOGGLE
          )
        }
      }
    }
  },
  remove(vnode: VNode, {
    r: remove, o: {
      remove: hostRemove
    }
  }: RendererInternals) {
    const { shapeFlag, children, anchor } = vnode
    hostRemove(anchor!)
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      for (let i = 0; i < (children as VNode[]).length; i++) {
        remove((children as VNode[])[i])
      }
    }
  },
  move: moveTeleport,
  hydrate: hydrateTeleport
}

// 强制casted h 和 TSX props 推理的公共拼写。
export const Teleport = (TeleportImpl as any) as {
  __isTeleport: true,
  new(): { $props: VNodeProps & TeleportProps }
}
