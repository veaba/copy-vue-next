export interface SuspenseBoundary {
  vnode: VNode<RendererNode, RendererElement, SuspenseProps>
  parent: SuspenseBoundary | null
  parentComponent: ComponentInternalInstance | null
  namespace: ElementNamespace
  container: RendererElement
  hiddenContainer: RendererElement
  activeBranch: VNode | null
  pendingBranch: VNode | null
  deps: number
  pendingId: number
  timeout: number
  isInFallback: boolean
  isHydrating: boolean
  isUnmounted: boolean
  effects: Function[]
  resolve(force?: boolean, sync?: boolean): void
  fallback(fallbackVNode: VNode): void
  move(
    container: RendererElement,
    anchor: RendererNode | null,
    type: MoveType,
  ): void
  next(): RendererNode | null
  registerDep(
    instance: ComponentInternalInstance,
    setupRenderEffect: SetupRenderEffectFn,
    optimized: boolean,
  ): void
  unmount(parentSuspense: SuspenseBoundary | null, doRemove?: boolean): void
}


// Suspense exposes a component-like API, and is treated like a component
// in the compiler, but internally it's a special built-in type that hooks
// directly into the renderer.
export const SuspenseImpl = {
  name: 'Suspense',
  // In order to make Suspense tree-shakable, we need to avoid importing it
  // directly in the renderer. The renderer checks for the __isSuspense flag
  // on a vnode's type and calls the `process` method, passing in renderer
  // internals.
  __isSuspense: true,
  process(
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    namespace: ElementNamespace,
    slotScopeIds: string[] | null,
    optimized: boolean,
    // platform-specific impl passed from renderer
    rendererInternals: RendererInternals,
  ): void {
    if (n1 == null) {
      mountSuspense(
        n2,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        optimized,
        rendererInternals,
      )
    } else {
      // #8678 if the current suspense needs to be patched and parentSuspense has
      // not been resolved. this means that both the current suspense and parentSuspense
      // need to be patched. because parentSuspense's pendingBranch includes the
      // current suspense, it will be processed twice:
      //  1. current patch
      //  2. mounting along with the pendingBranch of parentSuspense
      // it is necessary to skip the current patch to avoid multiple mounts
      // of inner components.
      if (
        parentSuspense &&
        parentSuspense.deps > 0 &&
        !n1.suspense!.isInFallback
      ) {
        n2.suspense = n1.suspense!
        n2.suspense.vnode = n2
        n2.el = n1.el
        return
      }
      patchSuspense(
        n1,
        n2,
        container,
        anchor,
        parentComponent,
        namespace,
        slotScopeIds,
        optimized,
        rendererInternals,
      )
    }
  },
  hydrate: hydrateSuspense as typeof hydrateSuspense,
  normalize: normalizeSuspenseChildren as typeof normalizeSuspenseChildren,
}