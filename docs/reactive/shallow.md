# shallow

- shallow 针对的是 `.value` 属性才会触发响应式
- 可以使用 `triggerRef` 强制刷新
- 黑科技： 可以使用一个非正常的属性 `.dep.trigger()` 来实现

