import { getGlobalThis } from '@vue/shared'

export const enum ShapeFlags {
  ELEMENT = 1,
  FUNCTIONAL_COMPONENT = 1 << 1, // 左位操作符
  STATEFUL_COMPONENT = 1 << 2,
  TEXT_CHILDREN = 1 << 3,
  ARRAY_CHILDREN = 1 << 4,
  SLOTS_CHILDREN = 1 << 5,
  TELEPORT = 1 << 6,
  SUSPENSE = 1 << 7,
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8,
  COMPONENT_KEPT_ALIVE = 1 << 9,
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT
}

/**
 * This is only called in esm-bundler builds.
 * It is called when a renderer is created, in `baseCreateRenderer` so that
 * importing runtime-core is side-effects free.
 *
 * istanbul-ignore-next
 */
export function initFeatureFlags() {
  let needWarn = false
  if (typeof __FEATURE_OPTIONS_API__ !== 'boolean') {
    needWarn = true
    getGlobalThis().__VUE_OPTIONS_API__ = true
  }
  if (typeof __FEATURE_PROD_DEVTOOLS__ !== 'boolean') {
    needWarn = true
    getGlobalThis().__VUE_PROD_DEVTOOLS__ = false
  }

  if (__DEV__ && needWarn) {
    console.warn(
      `You are running the esm-bundler build of Vue. It is recommended to ` +
      `configure your bundler to explicitly replace feature flag globals ` +
      `with boolean literals to get proper tree-shaking in the final bundle. ` +
      `See http://link.vuejs.org/feature-flags for more details.`
    )
  }
}
