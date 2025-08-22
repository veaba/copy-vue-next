# copy-vue-next

Override for vue-next.

## Structure

public npm packages：

|`packages/*`||
|---|---|
|`compiler-core`||
|`compiler-dom`||
|`compiler-sfc`||
|`compiler-ssr`||
|`compiler-reactivity`||
|`runtime-core`||
|`runtime-dom`||
|`runtime-test`||
|`server-renderer`||
|`shared`||
|`vue`||
|`vue-compat`||

private npm packages：

|`packages-private/*`||
|---|---|
|`dts-built-test`||
|`dts-test`||
|`sfc-playground`||
|`template-explorer`||
|`compiler-reactivity`||
|`vite-debug`||

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

- webStorm 中，似乎存在 format 错误，导致 `packages/runtime-core/src/componentOptions.ts` 中的 `ComponentOptions` 报红

- ts `unknown` 与 `any` 区别

`unknown` 迫使我们对变量类型做额外的类型检查

- [hydration](https://www.veitor.net/posts/what-is-meaning-of-hydration-in-programming/)

可以理解为对象提供水分，为什么对象呢？就是刚实例化的对象。并且我们最常见提到“水合”的地方就是刚从数据库或其他存储介质中取出数据填充到对象上。

那么这种一个已经在内存中实例化的对象，还没有包含任何数据，然后用数据（例如从数据库、网络、文件系统等获取的）填充到该对象内，这种行为成为 hydration 水合。

常见的一种水合方式就是序列化和反序列化了，如在 PHP 中对对象进行 `serialize` 和 `unserialize` ，此时的反序列化 == 实例化+水合。

- ts 中 `|=语法`

```ts
vnode.shapeFlag |= type
```

- ts 似乎一个bug？判断空对象

```ts
if (setupState !== EMPTY_OBJ && hasOwn(setupState, key)) {
  // todo? 
}
```

尽管对象引用是同一个对象的时候，是可以在做判断的

```ts

var a = {}
var b = {}

console.info(a === b); // true
```

但是为什么，props 、data 都要指向同一个空对象（EMPTY_OBJ）呢？

- ts 中，typeof 字符变量为何作为type

```ts
const COMPONENTS = 'components'

function resolveAsset(
  type: typeof COMPONENTS,
  name: string
) {
  // 直接写 `type: string` 不香吗？ 
}
```

- 巧妙的使用 解构+set 来实现去重

```ts
console.log([...new Set([11, 1, 1, 1, 1, 1])])
```

- 设置数组的 length=0 的意义

在于还是初始化一开始的内存地址，如果赋值 `arr=[]` 则是新的内存地址

## test

测试 reactivity

> jest packages/reactivity
