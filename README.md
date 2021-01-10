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

## learning

- typeScript: `infer K`
	- ts 类型推断

- 在ts 开发中，省略 `{`，`}` 容易丢失

```js
if (!effect.active) {
	return options.scheduler ? undefined : fn()
}
// 经过ts 编译后，容易丢失，变成下面的情况
if (!effect.active)
	return options.scheduler ? undefined : fn()

```

或者

```ts
if (isReadonly(value)) return isReactive((value as Target)[ReactiveFlags.RAW])
// 最后成这样=>
if (isReadonly(value))
    return isReactive((value as Target)[ReactiveFlags.RAW])
```

- 虽然 ts 编译过程，增加 `.js`后缀让,Chrome 运行 ES6 module 的语法，但是，jest 无法调用 `.js` 后缀的路径

- ts中，为什么在 type 声明是 `|` 开头的？

```ts
type VNodeChildAtom =
    | VNode
    | string
```

- ts 中，感叹号在后面是做什么？

```ts
const instance: ComponentInternalInstance = {
    uid: uid++,
    vnode,
    type,
    parent,
    appContext,
    root: null!,// TODO: to be immediately set
    next: null,
    subTree: null!, // 将在创建后同步设置

}
```

> 这是有时候 以ts 无法识别的方式初始化属性。使用感叹号，确定分配的断言，关闭 ts 的警告

- ts 中，Record

> 把K 的每个属性都转为T类型

- webstorm 中，似乎存在format 错误，导致 `packages/runtime-core/src/componentOptions.ts` 中的 `ComponentOptions` 报红
