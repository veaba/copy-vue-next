# copy-vue-next

Override for vue-next.

## Structure

## runtime-core

### vNode

## new syntax

1. `;` begin syntax

```ts
export function recordInstanceBoundEffect(effect: ReactiveEffect) {
  if (currentInstance) {
    ;(currentInstance.effects || (currentInstance.effects = [])).push(effect)
  }
}
```

2. `options` new line

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

3. `as` syntax

```ts
const c = _computed(getterOrOptions as any); 
```
