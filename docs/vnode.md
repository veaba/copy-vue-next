# vnode

## vnode 模型

```ts
const vnode = {
    __v_isVNode: true,
    __v_skip: true,
    type,
    props,
    key:props && normalizeKey(props),
    ref:props && normalizeRef(props),
    scopeId: currentScopeId,
    slotScopeIds:null,
    children,
    component:null,
    suspense:null,
    ssContent:null,
    ssFallback:null,
    dirs:null,
    transition:null,
    el:null,
    anchor:null,
    target:null,
    targetStart:null,
    targetAnchor:null,
    staticCount:0,
    shapeFlag,
    patchFlag,
    dynamicProps,
    dynamicChildren:null,
    appContext:null,
    ctx:currentRenderingInstance,
  } as VNode
```
