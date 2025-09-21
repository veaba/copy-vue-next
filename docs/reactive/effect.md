# effect

## cleanupEffect 函数

## cleanupDeps 函数

- 把 activeSub 给 prevSub
- activeSub = undefined
- 执行 cleanup()

## removeSub 函数

- nextSub 给 prevSub.nextSub 删除 link.prevSub
- prevSub 给 nextSub.prevSub 删除 link.nextSub
- computed 情况软删
- dep 属性需要删除 key

## 什么情况下需要删除 key

<https://github.com/vuejs/core/issues/11979>

```vue
<script setup>
import { reactive, ref } from 'vue'

class VTrack {}

const s = reactive(new Set())
const k = ref()

function newKey() {
  k.value = new VTrack()
}
</script>

<template>
  <h1>{{ s.has(k) }}</h1>
  <button @click="newKey">
    New
  </button>
</template>

```

## effect 如何观测到响应式变量？

```ts
import { ref, reactive, effect } from 'vue'

const msg = ref('Hello World!')
const map = reactive(new Map())
effect(()=>{
  console.log("map=>",map.get("key1"))

})

const onClick = ()=>{
  msg.value = msg.value +"\n"+ (new Date().getTime())
  map.set("key1",new Date().getTime())

}
```

`effect` 接受 `fn`，`fn` 传入 `class ReactiveEffect`

## effect 8 个 状态

| 状态            | 作用     |
|-----------------|----------|
| `ACTIVE`        | 激活     |
| `RUNNING`       | 正在运行 |
| `TRACKING`      | 追踪中   |
| `NOTIFIED`      | 通知     |
| `DIRTY`         | 脏检查   |
| `ALLOW_RECURSE` | 允许递归 |
| `PAUSED`        | 暂停     |
| `EVALUATED`     | 评估     |

- class `ReactiveEffect` 默认 flags 是 `ACTIVE` 和 `TRACKING`
- `prepareDeps` 为准备 deps 阶段，重置 sub `version = -1` 等

## ReactiveEffect class

### run 函数的收尾阶段

- 清理 deps
- 上一个 prevEffect 给 activeEffect
- 上一个 prevShouldTrack 给 shouldTrack
- this.flags 移除  `RUNNING`
