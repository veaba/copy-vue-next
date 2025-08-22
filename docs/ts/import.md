# ts 的 导出

## enum export

```ts
// a.ts
export const enum ElementTypes {
  ELEMENT,
  COMPONENT,
  SLOT,
  TEMPLATE
}

```

```diff
# b.ts
+ import { ElementTypes } from './a'
- import { type ElementTypes } from './a.ts'
```

这里延伸出来一个问题，为什么 type 的 export 不能使用关键字呢？

比如

```ts
// a.ts
export interface SourceLocation {
  start: Position
  end: Position
  source: string
}

```

```diff
# b.ts
+ import { type SourceLocation } from './a'
- import { SourceLocation } from './a'
```

我们是不是可以自然的延伸出来，可以使用关键字  `enum` import 进来

```diff
# b.ts
+ import { enum ElementTypes } from './a'
- import { ElementTypes } from './a.ts'
```
