# 全局函数

| 全局定义         | 作用 |
|--------------|----|
| `startBatch` |    |
| `endBatch`   |    |

## startBatch

批量深度，`batchDepth++`

## endBatch

执行复杂的批处理计算属性操作。

- 有批处理深度，直接返回
- 重置批处理计算属性
- 处理活跃的订阅者，触发更新订阅者：`trigger()`
