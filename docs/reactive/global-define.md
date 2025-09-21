# global-define

## 全局定义

| 全局定义                | 所属模块       | 作用                              |
|---------------------|------------|---------------------------------|
| `activeEffectScope` | `Effect`   | 有激活的则会被push 到栈中                 |
| `activeSub`         | `Effect`   | 正在激活的订阅者，为 `ReactiveEffect` 的实例 |
| `shouldTrack`       | `Effect`   | 应该追踪标记，boolean，默认 `true`        |
| `batchDepth`        | `Computed` | 批处理深度                           |
| `batchedSub`        | `Computed` | 批处理订阅者                          |
| `batchedComputed`   | `Computed` | 批处理计算属性                         |
