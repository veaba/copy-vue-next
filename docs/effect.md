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
