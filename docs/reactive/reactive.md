# 响应式

| 响应式进阶 API           | 说明                                  |
|---------------------|-------------------------------------|
| `shallowRef()`      | 仅 `.value` 响应式，不深层转换，大型数据结构         |
| `triggerRef()`      | `shallowRef()` 配合触发                 |
| `customRef()`       | 自定义工厂函数控制 `trigger` 合适触发            |
| `shallowReactive()` | 根级响应式，二级不触发，和 `shallowReadonly` 相反  |
| `shallowReadonly()` | 二级响应式，根级失败，和 `shallowReactive()` 相反 |
| `toRaw()`           | 找回原始对象， vue 的 $data 的 类似            |
| `markRaw()`         | 返回不可转为代理的对象本身                       |
| `effectScope()`     | 捕获 `computed` 和 `watch`             |
| `getCurrentScope()` | 返回活跃的 `effect` 作用域                  |
| `onScopeDispose()`  | 活跃的 effect 作用域注册一个回调，作用域停止时触发       |

## 基本规则

- `reactive()` 函数入参必须是对象

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
enum ReactiveFlags {
  SKIP = '__v_skip',
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly',
  IS_SHALLOW = '__v_isShallow',
  RAW = '__v_raw',
  IS_REF = '__v_isRef',
}
```

- 递归读取 `[ReactiveFlags.RAW]`

## reactive 和 ref 函数区别

- `ref` 判断是对象，则调用 `reactive` 来创建
- `ref` 任意类型
- `reactive` 只能是对象