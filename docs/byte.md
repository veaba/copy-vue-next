# 位操作比较

微操作是原子性的，在内存要求高的场景，可以看到这样的写法

## Effect 回收

resume 函数判断当前的 `flags` 是否有 `PAUSED` 才进行下一步：

```ts

export enum EffectFlags {
    /**
     * ReactiveEffect only
     */
    ACTIVE = 1 << 0,
    RUNNING = 1 << 1,
    TRACKING = 1 << 2,
    NOTIFIED = 1 << 3,
    DIRTY = 1 << 4,
    ALLOW_RECURSE = 1 << 5,
    PAUSED = 1 << 6,
    EVALUATED = 1 << 7,
}
// ...

if(this.flags & EffectFlags.PAUSED){
  // 移除 PAUSED 标志
  this.flags &= ~EffectFlags.PAUSED
}
```

移除操作：

```ts
this.flags &= ~EffectFlags.PAUSED
```

检查是否包含：

```ts
if (this.flags & EffectFlags.RUNNING) {
  // 如果 RUNNING 位是 1，则条件为真，表示正在运行
  console.log('Effect is running!');
}
```

切换为操作，`关=>开=>关=>开……`相反状态之间切换：

```ts
this.flags ^= EffectFlags.RUNNING;
```

设置为,一定会 RUNNING ：

```ts
this.flags |= EffectFlags.RUNNING;
```
