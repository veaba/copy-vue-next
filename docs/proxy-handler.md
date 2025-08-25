# Proxy 的 处理器

## 在 get 时候处理如下场景

变量包括：`target`、`key`、`receiver`

- `key = isReactive`
- `key = isReadonly`
- `key = isShallow`
- `key = isRaw`
- `isArray`
- `isObject`
- `key = isSymbol`
- `!isReadonly`
- `isShallow`
- `ref = isRef`
- `ref = isObject`
