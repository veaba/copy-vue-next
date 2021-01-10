export const enum SlotFlags {
    /**
     * 稳定的 slots，只引用 slot prop 或上下文状态。slot 可以完全捕获自己的依赖关系，
     * 所以当父级传递下来时，不需要强制 children 更新。
     * */
    STABLE = 1,
    /**
     * 引用作用域变量（v-for或外槽道具），或具有条件结构（v-if，v-for）的slot。
     * 父级需要强制子级更新，因为 slot 没有完全捕获其依赖性。
     * */
    DYNAMIC = 2,
    /**
     * `<slot/>`被转入子组件。父组件是否需要更新子组件，
     * 取决于父组件本身收到了什么样的 slot。这必须在 runtime，
     * 在创建子组件的 vnode 时进行细化（在 `normalizeChildren` 中）。
     * */
    FORWARDED = 3
}
