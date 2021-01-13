// 在渲染过程中标记当前渲染实例进行资产解析(如resolveComponent, resolveDirective）
import { ComponentInternalInstance, FunctionalComponent } from './component'
import { ShapeFlags } from './shapeFlags'
import { Comment, createVNode, isVNode, normalizeVNode, VNode, VNodeArrayChildren } from './vnode'
import { ErrorCodes, handleError } from './errorHanding'
import { warn } from './warning'

export let currentRenderingInstance: ComponentInternalInstance | null = null

export function setCurrentRenderingInstance(
  instance: ComponentInternalInstance | null
) {
  currentRenderingInstance = instance
}

// 仅用于跟踪 $attrs 是否是在渲染过程中被使用的开发标志,
// 如果在渲染过程中使用了$attrs，那么可以抑制 attrs 失败的警告。
let accessedAttrs: boolean = false

/**
 * 渲染组件根节点
 * */
export function renderComponentRoot(
  instance: ComponentInternalInstance
): VNode {
  const {
    type: Component,
    vnode,
    proxy,
    withProxy,
    props,
    propsOptions: [propsOptions],
    slots,
    attrs,
    emit,
    render,
    renderCache,
    data,
    setupState,
    ctx
  } = instance

  let result
  currentRenderingInstance = instance
  if (__DEV__) {
    accessedAttrs = false
  }

  try {
    let fallthroughAttrs
    // & 操作
    if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
      // withProxy是一个具有不同 `has` trap 的 proxy，
      // 只适用于使用 "with" 块的运行时编译的渲染函数。
      const proxyToUse = withProxy || proxy
      result = normalizeVNode(
        render!.call(
          proxyToUse,
          proxyToUse!,
          renderCache,
          props,
          setupState,
          data,
          ctx
        )
      )
      fallthroughAttrs = attrs
    } else {
      // functional
      const render = Component as FunctionalComponent
      // in dev,如果有可选的 props（attrs === props），则标记 attrs 访问。
      if (__DEV__ && attrs === props) {
        markAttrsAccessed()
      }
      result = normalizeVNode(
        render.length > 1
          ? render(
          props,
          __DEV__
            ? {
              props,
              get attrs() {
                markAttrsAccessed()
                return attrs
              },
              slots,
              emit
            }
            : { props, attrs, slots, emit }
          )
          : render(props, null as any)  /* 我们知道它不需要 */
      )
      fallthroughAttrs = Component.props ? attrs : getFunctionalFallthrough(attrs)
    }

    // attr 融合
    // 在 dev 模式，注释被保留下来，而且一个模板可以在根元素旁边有注释，这使得它成为一个片段
    let root = result
    let setRoot: ((root: VNode) => void) | undefined = undefined
    if (__DEV__) {
      ;[root, setRoot] = getChildRoot(result)
    }

    if (Component.inheritAttrs !== false && fallthroughAttrs) {
      const keys = Object.keys(fallthroughAttrs)
      const { shapeFlag } = root
      if (keys.length) {
        if (shapeFlag & ShapeFlags.ELEMENT ||
          shapeFlag & ShapeFlags.COMPONENT
        ) {
          if (propsOptions && keys.some(isModelListener)) {
            // If a v-model listener (onUpdate:xxx) has a corresponding declared
            // prop, it indicates this component expects to handle v-model and
            // it should not fallthrough.
            // related: #1543, #1643, #1989
            fallthroughAttrs = filterModelListeners(
              fallthroughAttrs,
              propsOptions
            )
          }
          root = cloneVNode(root, fallthroughAttrs)
        } else if (__DEV__ && !accessedAttrs && root.type !== Comment) {
          const allAttrs = Object.keys(attrs)
          const eventAttrs: string[] = []
          const extraAttrs: string[] = []
          for (let i = 0, l = allAttrs.length; i < l; i++) {
            const key = allAttrs[i]
            if (isOn(key)) {
              // 当v-model处理程序未能通过时，忽略它们。
              if (!isModelListener(key)) {
                // remove `on`,  首字母小写，以准确反映事件的发展脉络。
                eventAttrs.push(key[2].toLowerCase() + key.slice(3))
              }
            } else {
              extraAttrs.push(key)
            }
          }
          if (extraAttrs.length) {
            warn(
              `Extraneous non-props attributes (` +
              `${extraAttrs.join(', ')}) ` +
              `were passed to component but could not be automatically inherited ` +
              `because component renders fragment or text root nodes.`
            )
          }
          if (eventAttrs.length) {
            warn(
              `Extraneous non-emits event listeners (` +
              `${eventAttrs.join(', ')}) ` +
              `were passed to component but could not be automatically inherited ` +
              `because component renders fragment or text root nodes. ` +
              `If the listener is intended to be a component custom event listener only, ` +
              `declare it using the "emits" option.`
            )
          }
        }
      }
    }
    // 继承指令
    if (vnode.dirs) {
      if (__DEV__ && !isElementRoot(root)) {
        warn(
          `Runtime directive used on component with non-element root node. ` +
          `The directives will not function as intended.`
        )
      }
      root.dirs = root.dirs ? root.dirs.concat(vnode.dirs) : vnode.dirs
    }

    // 继承 transition data
    if (vnode.transition) {
      if (__DEV__ && !isElementRoot(root)) {
        warn(
          `Component inside <Transition> renders non-element root node ` +
          `that cannot be animated.`
        )
      }
      root.transition = vnode.transition
    }

    if (__DEV__ && setRoot) {
      setRoot(root)
    } else {
      result = root
    }
  } catch (err) {
    handleError(err, instance, ErrorCodes.RENDER_FUNCTION)
    result = createVNode(Comment)
  }
  currentRenderingInstance = null
  return result
}

/**
 * dev only
 * */
export function filterSingleRoot(children: VNodeArrayChildren): VNode | null {
  const filtered = children.filter(child => {
    return !(
      isVNode(child) &&
      child.type === Comment &&
      child.children !== 'v-if'
    )
  })
  return filtered.length === 1 && isVNode(filtered[0]) ? filtered[0] : null
}


export function updateHOCHostEl(
  { vnode, parent }: ComponentInternalInstance,
  el: typeof vnode.el // HostNode
) {
  while (parent && parent.subTree === vnode) {
    ;(vnode = parent.vnode).el = el
    parent = parent.parent
  }
}
