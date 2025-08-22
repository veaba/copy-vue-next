# 性能

## 对于 on 的判断

```diff
# before
- const onRE = /^on[^a-z]/
- export const isOn = (key: string) => onRE.test(key)

# after
+ export const isOn = (key: string): boolean =>
+   key.charCodeAt(0) === 111 /* o */ &&
+   key.charCodeAt(1) === 110 /* n */ &&
+   // uppercase letter
+   (key.charCodeAt(2) > 122 || key.charCodeAt(2) < 97)

```

## 严格的字符定义

```diff
- export const isModelListener = (key: string) => key.startsWith('onUpdate:')
+ export const isModelListener = (key: string):key is `onUpdate:${string}` => key.startsWith('onUpdate:')
```
