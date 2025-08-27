# 计算属性

- `computed` 也是一个 subscriber（订阅者）

## computed 递归计算何时中断？

```ts
 test('should not lead to exponential perf cost with deeply chained computed', () => {
    const start = {
      prop1: shallowRef(1),
      prop2: shallowRef(2),
      prop3: shallowRef(3),
      prop4: shallowRef(4),
    }

    let layer = start

    const LAYERS = 10000

    for (let i = LAYERS; i > 0; i--) {
      const m = layer
      const s = {
        prop1: computed(() => m.prop2.value),
        prop2: computed(() => m.prop1.value - m.prop3.value),
        prop3: computed(() => m.prop2.value + m.prop4.value),
        prop4: computed(() => m.prop3.value),
      }
      effect(() => s.prop1.value)
      effect(() => s.prop2.value)
      effect(() => s.prop3.value)
      effect(() => s.prop4.value)

      s.prop1.value
      s.prop2.value
      s.prop3.value
      s.prop4.value

      layer = s
    }

    const t = performance.now()
    start.prop1.value = 4
    start.prop2.value = 3
    start.prop3.value = 2
    start.prop4.value = 1
    expect(performance.now() - t).toBeLessThan(process.env.CI ? 100 : 30)

    const end = layer
    expect([
      end.prop1.value,
      end.prop2.value,
      end.prop3.value,
      end.prop4.value,
    ]).toMatchObject([-2, -4, 2, 3])
  })
```

在 ReactiveEffect 中的 `run` 函数增加 `let c = 0` 来记录计算次数，发现递归计算次数长达： `9334`：

```ts
try {
  c++
  console.log(" run c ",c) // 9334
  return this.fn()
} 
```

那么，为什么是 9334 呢？