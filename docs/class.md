# ts 的 class

## class 声明差异

在 2021 年  vue 3 起初的写法和 2025 有了很大的变化

```diff
- export class ComputedRefImpl {
+ export class ComputedRefImpl<T> implements Subscriber {
-  private _value!: T
+ _value: any = undefined
```
