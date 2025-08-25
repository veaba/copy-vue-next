# render

vue runtime-core 核心 的函数


- `createRenderer` 函数返回 `baseCreateRenderer` 函数，
- `baseCreateRenderer` 三次重载函数定义
  - 创建水合函数
  - 或水合 `HydrationRenderer`，有三个返回对象
    - `render` —— 继承于 `Reader`
    - `createApp` —— 继承于  `Reader`
    - `hydrate` —— 属于 `HydrationRenderer`