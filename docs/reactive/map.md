# Map

## 基本概念

- `delete` 不存在的 key，不会触发 effect，有 key 才会 `trigger`
- `clear` 有 key 的 clear 会触发 `trigger`，没key 的 clear 不会触发 `trigger`
- `toRaw` 函数转换为普通对象会被观测到，当它在对 map 进行操作时

## new Map() 可以被响应式

```ts
import { reactive, isReactive } from '@vue/reactivity'
const map = new Map()
const observed = reactive(map)
expect(isReactive(observed)).toBe(true)
```

## Map 可以被观测到

| 实例方法/行为     | 可观测 |   |
|-------------------|--------|---|
| `get`             | ✅      |   |
| `set`             | ✅      |   |
| `delete`          | ✅      |   |
| `keys`            | ✅      |   |
| `values`          | ✅      |   |
| `entries`         | ✅      |   |
| `entries`         | ✅      |   |
| `custom property` | ❎      |   |

