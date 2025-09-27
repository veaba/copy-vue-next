# global-define

## 全局定义

| 全局定义                 | 所属模块         | 作用                              |
|----------------------|--------------|---------------------------------|
| `activeEffectScope`  | `Effect`     | 有激活的则会被push 到栈中                 |
| `activeSub`          | `Effect`     | 正在激活的订阅者，为 `ReactiveEffect` 的实例 |
| `shouldTrack`        | `Effect`     | 应该追踪标记，boolean，默认 `true`        |
| `batchDepth`         | `Computed`   | 批处理深度                           |
| `batchedSub`         | `Computed`   | 批处理订阅者                          |
| `batchedComputed`    | `Computed`   | 批处理计算属性                         |
| `targetMap`          | `reactivity` | `track` 使用                      |
| `reactiveMap`        | `reactivity` | 响应式对象集合/缓存                      |
| `readonlyMap`        | `reactivity` | 响应式对象集合/缓存                      |
| `shallowReadonlyMap` | `reactivity` | 响应式对象集合/缓存                      |
| `shallowReactiveMap` | `reactivity` | 响应式对象集合/缓存                      |
| `cleanupMap`         | `watch`      | `watch` 使用                      |

### shouldTrack

- `pauseTracking()` 不再 track

## reactiveMap

- 会被 `ref()` 和 `reactive()` 共享一个缓存，通过 `toReactive()` 来关联