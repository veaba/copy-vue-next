import { withCtx } from './withRenderContext'

export let currentScopeId: string | null = null
const scopeIdStack: string[] = []

/**
 * @private
 * */
export function pushScopeId(id: string) {
  scopeIdStack.push((currentScopeId = id))
}

/**
 * @private
 * */
export function popScopeId() {
  scopeIdStack.pop()
  currentScopeId = scopeIdStack[scopeIdStack.length - 1] || null
}

/**
 * @private
 * */
export function withScopeId(id: string): <T extends Function>(fn: T) => T {
  return ((fn: Function) =>
      withCtx(function(this: any) {
        pushScopeId(id)
        const res = fn.apply(this, arguments)
        popScopeId()
        return res
      })
  ) as any
}
