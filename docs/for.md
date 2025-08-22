# for

```ts
for(let l = computed.deps; l; l = l.nextDep){
    addSub(l)
}
```

等价于：

```ts
let l = computed.deps;
while (l !== null && l !== undefined) {
    addSub(l);
    l = l.nextDep;
}
```
