# copy-vue-next

Override for vue-next.

## Structure

## runtime-core

### vNode 虚拟 DOM

## 学习

1. Vue-next 中，有大量 `;` 开头的代码。

```ts
export function recordInstanceBoundEffect(effect: ReactiveEffect) {
  if (currentInstance) {
    ;(currentInstance.effects || (currentInstance.effects = [])).push(effect)
  }
}
```

2. 这种呢？分号开头，换行是 `options` 单独一行

```ts
function parseName(name: string): [string, EventListenerOptions | undefined] {
  let options: EventListenerOptions | undefined;
  if (optionsModifierRE.test(name)) {
    options = {}
    let m;
    while ((m = name.match(optionsModifierRE))) {
      name = name.slice(0, name.length - m[0].length)
      ;(options as any)[m[0].toLowerCase()] = true
      options
    }
  }
  return [name.slice(2).toLowerCase(), options]
}
```

3. `as` 语句

```ts
const c = _computed(getterOrOptions as any); 
```