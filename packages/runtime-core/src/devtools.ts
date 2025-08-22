

export function setDevtoolsHook(hook: DevtoolsHook, target: any): void {
  devtools = hook
  if (devtools) {
    devtools.enabled = true
    buffer.forEach(({ event, args }) => devtools.emit(event, ...args))
    buffer = []
  } else if (
    // handle late devtools injection - only do this if we are in an actual
    // browser environment to avoid the timer handle stalling test runner exit
    // (#4815)
    typeof window !== 'undefined' &&
    // some envs mock window but not fully
    window.HTMLElement &&
    // also exclude jsdom
    // eslint-disable-next-line no-restricted-syntax
    !window.navigator?.userAgent?.includes('jsdom')
  ) {
    const replay = (target.__VUE_DEVTOOLS_HOOK_REPLAY__ =
      target.__VUE_DEVTOOLS_HOOK_REPLAY__ || [])
    replay.push((newHook: DevtoolsHook) => {
      setDevtoolsHook(newHook, target)
    })
    // clear buffer after 3s - the user probably doesn't have devtools installed
    // at all, and keeping the buffer will cause memory leaks (#4738)
    setTimeout(() => {
      if (!devtools) {
        target.__VUE_DEVTOOLS_HOOK_REPLAY__ = null
        devtoolsNotInstalled = true
        buffer = []
      }
    }, 3000)
  } else {
    // non-browser env, assume not installed
    devtoolsNotInstalled = true
    buffer = []
  }
}

export const devtoolsComponentUpdated: DevtoolsComponentHook =
  /*@__PURE__*/ createDevtoolsComponentHook(DevtoolsHooks.COMPONENT_UPDATED)

  
export const devtoolsComponentAdded: DevtoolsComponentHook =
  /*@__PURE__*/ createDevtoolsComponentHook(DevtoolsHooks.COMPONENT_ADDED)

  export const devtoolsComponentRemoved = (
  component: ComponentInternalInstance,
): void => {
  if (
    devtools &&
    typeof devtools.cleanupBuffer === 'function' &&
    // remove the component if it wasn't buffered
    !devtools.cleanupBuffer(component)
  ) {
    _devtoolsComponentRemoved(component)
  }
}
