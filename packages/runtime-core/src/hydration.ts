import { Comment, Fragment, normalizeVNode, Static, VNode, VNodeHook } from './vnode'
import { invokeVNodeHook, RendererInternals, setRef } from './renderer'
import { warn } from './warning'
import { ComponentInternalInstance } from './component'
import { queueEffectWithSuspense, SuspenseBoundary, SuspenseImpl } from './components/Suspense'
import { ShapeFlags } from '../../shared/src/shapeFlags'
import { ComponentOptions } from './componentOptions'
import { TeleportImpl, TeleportVNode } from './components/Teleport'
import { PatchFlags } from '../../shared/src/patchFalgs'
import { isOn, isReservedProp } from '@vue/shared'
import { invokeDirectiveHook } from './directives'
import { flushPostFlushCbs } from './scheduler'

let hasMismatch = false

export type  RootHydrateFunction = (
  vnode: VNode<Node, Element>,
  container: Element
) => void

const enum DOMNodeTypes {
  ELEMENT = 1,
  TEXT = 3,
  COMMENT = 8
}

const isSVGContainer = (container: Element) =>
  /svg/.test(container.namespaceURI!) && container.tagName !== 'foreignObject'

const isComment = (node: Node): node is Comment =>
  node.nodeType === DOMNodeTypes.COMMENT

/**
 * 注：水合是DOM特有的
 * 但由于与核心的紧密耦合，我们必须把它放在核心中--把它拆分出来会造成一大堆不必要的复杂性。
 * 水合也依赖于一些渲染器的内部逻辑，需要通过参数传递进来。
 * */
export function createHydrationFunctions(
  rendererInternals: RendererInternals<Node, Element>
) {
  const {
    mt: mountComponent,
    p: patch,
    o: {
      patchProp, nextSibling, parentNode, remove, insert, createComment
    }
  } = rendererInternals

  const hydrate: RootHydrateFunction = (vnode, container) => {
    if (__DEV__ && !container.hasChildNodes()) {
      warn(
        `Attempting to hydrate existing markup but container is empty. ` +
        `Performing full mount instead.`
      )
      patch(null, vnode, container)
      return
    }
    hasMismatch = false
    hydrateNode(container.firstChild!, vnode, null, null)
    flushPostFlushCbs()
    if (hasMismatch && !__TEST__) {
      // 这个错误应该在生产中出现
      console.error(`Hydration completed but contains mismatches.`)
    }
  }
  const hydrateNode = (
    node: Node,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    optimized = false
  ): Node | null => {
    const isFragmentStart = isComment(node) && node.data === '['
    const onMismatch = () =>
      handleMismatch(
        node, vnode, parentComponent, parentSuspense, isFragmentStart
      )
    const { type, ref, shapeFlag } = vnode
    const domType = node.nodeType
    vnode.el = node

    let nextNode: Node | null = null
    switch (type) {
      case Text:
        if (domType !== DOMNodeTypes.TEXT) {
          nextNode = onMismatch()
        } else {
          if ((node as Text).data !== vnode.children) {
            hasMismatch = true
            __DEV__ &&
            warn(
              `Hydration text mismatch:` +
              `\n- Client: ${JSON.stringify((node as Text).data)}` +
              `\n- Server: ${JSON.stringify(vnode.children)}`
            )
            ;(node as Text).data = vnode.children as string
          }
          nextNode = nextSibling(node)
        }
        break
      case Comment:
        if (domType !== DOMNodeTypes.COMMENT || isFragmentStart) {
          nextNode = onMismatch()
        } else {
          nextNode = nextSibling(node)
        }
        break
      case Static:
        if (domType !== DOMNodeTypes.ELEMENT) {
          nextNode = onMismatch()
        } else {
          // 确定 anchor，采用内容
          nextNode = node
          // 如果静态 vnode 的内容在构建过程中被剥离，
          // 则从服务器渲染的 HTML 中采用它。
          const needToAdoptContent = !(vnode.children as string).length
          for (let i = 0; i < vnode.staticCount; i++) {
            if (needToAdoptContent) {
              vnode.children += (nextNode as Element).outerHTML
            }
            if (i === vnode.staticCount - 1) {
              vnode.anchor = nextNode
            }
            nextNode = nextSibling(nextNode)!
          }
          return nextNode
        }
        break
      case Fragment:
        if (!isFragmentStart) {
          nextNode = onMismatch()
        } else {
          nextNode = hydrateFragment(
            node as Comment,
            vnode,
            parentComponent,
            parentSuspense,
            optimized
          )
        }
        break
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          if (domType !== DOMNodeTypes.ELEMENT ||
            vnode.type !== (node as Element).tagName.toLowerCase()
          ) {
            nextNode = onMismatch()
          } else {
            nextNode = hydrateElement(
              node as Element,
              vnode,
              parentComponent,
              parentSuspense,
              optimized
            )
          }
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // 在设置渲染效果时，如果初始vnode已经设置了.el，
          // 组件将在其子树上执行水化而不是挂载。
          const container = parentNode(node)!
          const hydrateComponent = () => {
            mountComponent(
              vnode, container, null, parentComponent, parentSuspense, isSVGContainer(container), optimized
            )
          }
          // 异步组件
          const loadAsync = (vnode.type as ComponentOptions).__asyncLoader
          if (loadAsync) {
            loadAsync().then(hydrateComponent)
            hydrateComponent()
          }
          // 组件可能是异步的，所以在片段的情况下，
          // 我们不能依靠组件的渲染输出来确定片段的结束，
          // 而是要做一个lookahead来寻找结束锚节点。
          nextNode = isFragmentStart ? locateClosingAsyncAnchor(node)
            : nextSibling(node)
        } else if (shapeFlag & ShapeFlags.TELEPORT) {
          if (domType !== DOMNodeTypes.COMMENT) {
            nextNode = onMismatch()
          } else {
            nextNode = (vnode.type as typeof TeleportImpl).hydrate(
              node, vnode as TeleportVNode, parentComponent, parentSuspense,
              optimized, rendererInternals, hydrateChildren
            )
          }
        } else if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
          nextNode = (vnode.type as typeof SuspenseImpl).hydrate(
            node, vnode, parentComponent, parentSuspense, isSVGContainer(parentNode(node)!),
            optimized, rendererInternals, hydrateNode
          )
        } else if (__DEV__) {

        }
        warn('Invalid HostVNode type:', type, `(${typeof type})`)
    }
    // switch end

    if (ref != null && parentComponent) {
      setRef(ref, null, parentComponent, parentSuspense, vnode)
    }
    return nextNode
  }

  const hydrateElement = (
    el: Element,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    optimized: boolean
  ) => {
    optimized = optimized || !!vnode.dynamicChildren
    const { props, patchFlag, shapeFlag, dirs } = vnode
    // 如果是被吊起的静态节点则跳过 props & children
    if (patchFlag !== PatchFlags.HOISTED) {
      if (dirs) {
        invokeDirectiveHook(vnode, null, parentComponent, 'created')
      }
      // props
      if (props) {
        if (!optimized ||
          (patchFlag & PatchFlags.FULL_PROPS ||
            patchFlag & PatchFlags.HYDRATE_EVENTS
          )) {
          for (const key in props) {
            if (!isReservedProp(key) && isOn(key)) {
              patchProp(el, key, null, props[key])
            }
          }
        } else if (props.onClick) {
          // click listener 的快速路径（这是最常见的），以避免通过props迭代。
          patchProp(el, 'onClick', null, props.onClick)
        }
      }
      // vnode / directive hooks
      let vnodeHooks: VNodeHook | null | undefined
      if ((vnodeHooks = props && props.onVnodeBeforeMount)) {
        invokeVNodeHook(vnodeHooks, parentComponent, vnode)
      }
      if (dirs) {
        invokeDirectiveHook(vnode, null, parentComponent, 'beforeMount')
      }
      if ((vnodeHooks = props && props.onVnodeMounted) || dirs) {
        queueEffectWithSuspense(() => {
          vnodeHooks && invokeVNodeHook(vnodeHooks, parentComponent, vnode)
          dirs && invokeDirectiveHook(vnode, null, parentComponent, 'mounted')
        }, parentSuspense)
      }
      // children
      if (shapeFlag & ShapeFlags.ARRAY_CHILDREN &&
        // 如果element 有 innerHTML / textContent 则跳过
        !(props && (props.innerHTML || props.textContext))
      ) {
        let next = hydrateChildren(
          el.firstChild,
          vnode,
          el,
          parentComponent,
          parentSuspense,
          optimized
        )
        let hasWarned = false
        while (next) {
          hasMismatch = true
          if (__DEV__ && !hasWarned) {
            warn(
              `Hydration children mismatch in <${vnode.type as string}>: ` +
              `server rendered element contains more child nodes than client vdom.`
            )
            hasWarned = true
          }
          // SSRed DOM包含了更多的节点。移除它们。
          const cur = next
          next = next.nextSibling
          remove(cur)
        }
      } else if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
        if (el.textContent !== vnode.children) {
          hasMismatch = true
          __DEV__ && warn(
            `Hydration text content mismatch in <${vnode.type as string}>:\n` +
            `- Client: ${el.textContent}\n` +
            `- Server: ${vnode.children as string}`
          )
          el.textContent = vnode.children as string
        }
      }
    }
    return el.nextSibling
  }
  const hydrateChildren = (
    node: Node | null,
    parentVNode: VNode,
    container: Element,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    optimized: boolean
  ): Node | null => {
    optimized = optimized || !!parentVNode.dynamicChildren
    const children = parentVNode.children as VNode[]
    const l = children.length
    let hasWarned = false
    for (let i = 0; i < l; i++) {
      const vnode = optimized
        ? children[i]
        : (children[i] = normalizeVNode(children[i]))
      if (node) {
        node = hydrateNode(
          node, vnode, parentComponent, parentSuspense, optimized
        )
      } else {
        hasWarned = true
        if (__DEV__ && !hasWarned) {
          warn(
            `Hydration children mismatch in <${container.tagName.toLowerCase()}>: ` +
            `server rendered element contains fewer child nodes than client vdom.`
          )
          hasWarned = true
        }
        // SSRed DOM没有包含足够的节点。挂载缺少的节点。
        patch(
          null,
          vnode,
          container,
          null,
          parentComponent,
          parentSuspense,
          isSVGContainer(container)
        )
      }
    }
    return node
  }
  const hydrateFragment = (
    node: Comment,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    optimized: boolean
  ) => {
    const container = parentNode(node)!
    const next = hydrateChildren(
      nextSibling(node)!,
      vnode,
      container,
      parentComponent,
      parentSuspense,
      optimized
    )
    if (next && isComment(next) && next.data === ']') {
      return nextSibling((vnode.anchor = next))
    } else {
      // 片段没有成功水合，因为我们没有得到一个末端锚。
      // 这本应导致节点/子代不匹配的警告。
      hasMismatch = true
      // 由于没有锚，我们需要创建一个锚，并将其插入
      insert((vnode.anchor = createComment(']')), container, next)
      return next
    }
  }
  const handleMismatch = (
    node: Node,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    isFragment: boolean
  ): Node | null => {
    hasMismatch = true
    __DEV__ &&
    warn(
      `Hydration node mismatch:\n- Client vnode:`,
      vnode.type,
      `\n- Server rendered DOM:`,
      node,
      node.nodeType === DOMNodeTypes.TEXT
        ? `(text)`
        : isComment(node) && node.data === '['
        ? `(start of fragment)`
        : ``
    )
    vnode.el = null

    if (isFragment) {
      // 移除多余的 fragment 节点
      const end = locateClosingAsyncAnchor(node)
      while (true) {
        const next = nextSibling(node)
        if (next && next !== end) {
          remove(next)
        } else {
          break
        }
      }
    }
    const next = nextSibling(node)
    const container = parentNode(node)!
    remove(node)
    patch(
      null,
      vnode,
      container,
      next,
      parentComponent,
      parentSuspense,
      isSVGContainer(container)
    )
    return next
  }
  const locateClosingAsyncAnchor = (node: Node | null): Node | null => {
    let match = 0
    while (node) {
      node = nextSibling(node)
      if (node && isComment(node)) {
        if (node.data === '[') match++
        if (node.data === ']') {
          if (match === 0) {
            return nextSibling(node)
          } else {
            match--
          }
        }
      }
    }
    return node
  }
  return [hydrate, hydrateNode] as const
}
