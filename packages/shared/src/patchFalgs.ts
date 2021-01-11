export const enum PatchFlags {
  // Indicates an element with dynamic textContent (children fast path)
  // 指示具有动态文本内容（子快速路径）的元素
  TEXT = 1,

  // Indicates an element with dynamic class binding.
  // 指示具有动态类绑定的元素。
  CLASS = 1 << 1,

  // Indicates an element with dynamic style
  // 指示具有动态样式的元素
  // The compiler pre-compiles static string styles into static objects
  // + detects and hoists inline static objects
  // 编译器预编译静态字符串样式为静态对象+检测并提升内联静态对象

  // e.g. style="color: red" and :style="{ color: 'red' }" both get hoisted as
  //   const style = { color: 'red' }
  //   render() { return e('div', { style }) }
  STYLE = 1 << 2,

  // Indicates an element that has non-class/style dynamic props.
  // 指示具有非类/样式动态道具的元素。

  // Can also be on a component that has any dynamic props (includes
  // class/style). when this flag is present, the vnode also has a dynamicProps
  // 也可以位于具有任何动态道具（包括类/样式）的组件上。当这个标志出现时，vnode也有一个dynamicProps

  // array that contains the keys of the props that may change so the runtime
  // can diff them faster (without having to worry about removed props)
  // 该数组包含可能更改的道具键，以便运行时可以更快地对它们进行区分（不必担心移除的道具）
  PROPS = 1 << 3,

  // Indicates an element with props with dynamic keys. When keys change, a full
  // diff is always needed to remove the old key. This flag is mutually
  // exclusive with CLASS, STYLE and PROPS.
  // 指定带有带有动态键的属性的元素。当Keys更改时，总是需要一个完整的diff来删除旧key。此标志与CLASS、STYLE和PROPS互斥。
  FULL_PROPS = 1 << 4,

  // Indicates an element with event listeners (which need to be attached
  // during hydration)
  HYDRATE_EVENTS = 1 << 5,

  // Indicates a fragment whose children order doesn't change.
  STABLE_FRAGMENT = 1 << 6,

  // Indicates a fragment with keyed or partially keyed children
  KEYED_FRAGMENT = 1 << 7,

  // Indicates a fragment with unkeyed children.
  UNKEYED_FRAGMENT = 1 << 8,

  // Indicates an element that only needs non-props patching, e.g. ref or
  // directives (onVnodeXXX hooks). since every patched vnode checks for refs
  // and onVnodeXXX hooks, it simply marks the vnode so that a parent block
  // will track it.
  NEED_PATCH = 1 << 9,

  // Indicates a component with dynamic slots (e.g. slot that references a v-for
  // iterated value, or dynamic slot names).
  // Components with this flag are always force updated.
  DYNAMIC_SLOTS = 1 << 10,

  // SPECIAL FLAGS -------------------------------------------------------------

  // Special flags are negative integers. They are never matched against using
  // bitwise operators (bitwise matching should only happen in branches where
  // patchFlag > 0), and are mutually exclusive. When checking for a special
  // flag, simply check patchFlag === FLAG.

  // Indicates a hoisted static vnode. This is a hint for hydration to skip
  // the entire sub tree since static content never needs to be updated.
  HOISTED = -1,

  // A special flag that indicates that the diffing algorithm should bail out
  // of optimized mode. For example, on block fragments created by renderSlot()
  // when encountering non-compiler generated slots (i.e. manually written
  // render functions, which should always be fully diffed)
  // OR manually cloneVNodes
  BAIL = -2
}
