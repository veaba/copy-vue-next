# 响应式

## 创建响应式

- 先处理 readonly
- 否则创建响应式，使用函数 `createReactiveObject`

## reactive 函数设计

- 参数可以是对象
- 也可以是数组

### 对象实现

### 数组实现

## toRaw 函数

```ts
enum ReactiveFlags = {
    SKIP = '__v_skip',
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly',
  IS_SHALLOW = '__v_isShallow',
  RAW = '__v_raw',
  IS_REF = '__v_isRef',
}
```

- 递归读取 `[ReactiveFlags.RAW]`
