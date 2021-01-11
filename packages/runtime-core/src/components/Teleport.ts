import {
  ComponentInternalInstance,
  RendererElement,
  RendererNode,
  SuspenseBoundary, VNode, VNodeArrayChildren,
  VNodeProps
} from '@vue/runtime-core'
import { warn } from '@vue/runtime-core'
import { ShapeFlags } from '../shapeFlags'

export const isTeleport = (type: any): boolean => type.__isTeleport

export interface TeleportProps {
  to: string | RendererElement | null | undefined
  disabled?: boolean
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
    const disabled = isTeleportDisabled(n1.props)
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
          parentSuspense,
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
        if ((n2.props && n2.props.to) !== (n1.prop && n1.props.to)) {
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
              TeleportMoveType.TARGET_CHANGE
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
            h2,
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
