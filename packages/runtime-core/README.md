# @Vue/runtime-core

Runtime core

typing and building custom 渲染器，不在 `application` 中使用

## 构建一个自定义渲染器

```ts
import { createRenderer } from "@vue/runtime-core";

const { render, createApp } = createRenderer({
  patchProp,
  insert,
  remove,
  createElement,
});

export { render, createApp };

export * from "@vue/runtime-core";
```

- `render` 是低阶 API

- `createApp` 返回一个应用实例，其上下文可被整个应用树共享

- `@vue/runtime-dom` 是关于 DOM-targeting 渲染器的实现

## src/components

## src/helpers

## typos

```diff
- function mergeObjectOptions(to: Object | undefined, from: Object | undefined) {
+ function mergeObjectOptions(to: object | undefined, from: object | undefined) {
  return to ? extend(Object.create(null), to, from) : from
}

```

```diff
export interface AppRecord {
  id: number
  app: App
  version: string
-  types: Record<string, string | Symbol>
+  types: Record<string, string | symbol>
}
```
