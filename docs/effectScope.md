# effectScope

## stop 函数分别做什么？

- effect 逐个 stop, effects 数组长度设为为 0
- cleanup 逐个 执行，cleanups 数组长度设为 0
- scope 逐个 stop, scopes 数组长度设为 0
- 嵌套场景下，删除父级 scope，父级设置为 `undefined`
