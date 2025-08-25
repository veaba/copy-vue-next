# nextick

## 设计

- `currrentFlushPromise` 当前正在进行的异步更新任务的 promise，用于批量更新
- `resolvedPromise` 一个已经 resolved 的 promise 实例，作为备用的微任务队里

微任务 先取 `currentFlushPromise` ，再取 `resolvedPromise`。

如果又 fn 函数，则将其添加到微任务队列中，也就是 p.then() 内执行，同时处理 this，否则传递 fn。

如果没有回调函数，直接返回 Promise