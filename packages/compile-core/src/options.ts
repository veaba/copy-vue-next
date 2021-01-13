import { ElementNode, Namespace } from './ast'

export const enum BindingTypes {
  /**
   * 从 data() 返回
   * */
  DATA = 'data',
  /**
   * declared  as a prop
   * */
  PROPS = 'props',
  /**
   * let绑定（可以是ref，也可以不是ref）
   * */
  SETUP_LET = 'setup-let',
  /**
   * 永远不能作为引用的 const 绑定。
   * 在内联模板表达式中处理这些绑定时，不需要'unref（）`调用。
   * */
  SETUP_CONST = 'setup-const',
  /**
   * const 绑定可能是一个 ref
   * */
  SETUP_MAYBE_REF = 'setup-maybe-ref',
  /**
   * 保证为 refs 的绑定
   * */
  SETUP_REF = 'setup-ref',
  /**
   * 由其他options声明
   * e.g. computed、inject
   * */
  OPTIONS = 'options'
}

export interface BindingMetadata {
  [key: string]: BindingTypes | undefined
}

interface SharedTransformCodegenOptions {
  /**
   * * 将像{{ foo }}这样的表达式转换为`_ctx.foo`。
   * 如果这个选项为false，生成的代码将被包裹在一个"_ctx.foo "中。
   * `with (this) { ...}`。}` block
   * - 这在模块模式下是强制启用的，因为模块默认是严格的。
   * 不能使用`with`。
   * @default mode === 'module'
   */
  prefixIndentifiers?: boolean
  /**
   * 生成SSR优化的渲染函数。
   * 生成的函数必须附加到组件上，通过
   * `ssrRender'选项，而不是`render'。
   * */
  ssr?: boolean
  /**
   * 从脚本中分析出的可选绑定元数据--用于优化。
   * 启用 "prefixIdentifiers "时的绑定访问。
   * */
  bindingMetadata?: BindingMetadata
  /**
   * 编译函数，以便在setup()内部进行内联。
   * 这允许函数直接访问setup()的本地绑定
   * */
  inline?: boolean
  /**
   * 表示transform和codegen应该尝试输出有效的TS代码。
   * */
  isTS?: boolean

}

export interface ParserOptions {
  /**
   * @desc 平台原生elements
   * e.g. `div` from browsers
   * */
  isNativeTag?: (tag: string) => boolean
  /**
   * 可以自关闭原生elements
   * e.g. `<img>`、`<br>`、`<hr>`
   * */
  isVoidTag?: (tag: string) => boolean
  /**
   * 应该在内部保留空白的element
   * e.g. `<pre>`
   * */
  isPreTag?: (tag: string) => boolean
  /**
   * 平台指定内置组件
   * e.g. `<Transition>`
   * */
  isBuiltInComponent: (tag: string) => symbol | void
  /**
   * 供最终用户扩展原生元素列表的单独选项
   * */
  isCustomElement?: (tag: string) => boolean | void
  /**
   * 获得 tag 命名空间
   * */
  getNamespace?: (tag: string, parent: ElementNode | undefined) => Namespace
  /**
   * 获取此元素的文本解析模式
   * */
  getTextMode?: (
    node: ElementNode,
    parent: ElementNode | undefined
  ) => TextModes
  /**
   * @default ['{{','}}']
   * */
  delimiters?: [string, string]
  /**
   * 仅适用于 DOM 编译器
   * */
  decodeEntities?: (rawText: string, asAttr: boolean) => string
  onError?: (error: CompileError) => void
  /**
   * 在模板中保留注释，即使在生产中也是如此
   * */
  comments?: boolean
}

export interface TransformOptions extends SharedTransformCodegenOptions {
  /**
   * 应用于每个AST 节点的节点 transform 数组
   * */
  nodeTransforms?: NodeTransform[]

  /**
   * 一个{name:transform}对象，应用于元素节点上的每个指令属性节点。
   * */
  directiveTransforms?: Record<string, DirectiveTransforms | undefined>
  /**
   *  一个可选的钩子，用于转换被挂起的节点，由编译器-dom用于将被挂起的节点变成字符串化的HTML vnodes。
   * @default null
   * */
  transformHoist?: HoistTransform | null
  /**
   * 如果配对运行时提供了额外的内置元素，则使用该功能将它们标记为内置元素，
   * 这样编译器将为它们生成组件 vnodes。
   * */
  isBuiltInComponent?: (tag: string) => symbol | void
  /**
   * 被一些只期望原生元素的变换所使用。
   * */
  isCustomElement?: (tag: string) => boolean | void
  /**
   * Transform expressions like {{ foo }} to `_ctx.foo`.
   * If this option is false, the generated code will be wrapped in a
   * `with (this) { ... }` block.
   * - This is force-enabled in module mode, since modules are by default strict
   * and cannot use `with`
   * @default mode === 'module'
   */
  prefixIndentifiers?: boolean
  /**
   * 将静态VNodes和道具对象提升到`_hoisted_x`常量。
   * @default false
   * */
  hoistStatic?: boolean
  /**
   * Cache v-on handlers to avoid creating new inline functions on each render,
   * also avoids the need for dynamically patching the handlers by wrapping it.
   * e.g `@click="foo"` by default is compiled to `{ onClick: foo }`. With this
   * option it's compiled to:
   * ```js
   * { onClick: _cache[0] || (_cache[0] = e => _ctx.foo(e)) }
   * ```
   * - Requires "prefixIdentifiers" to be enabled because it relies on scope
   * analysis to determine if a handler is safe to cache.
   * @default false
   */
  cacheHandlers?: boolean
  /**
   * A list of parser plugins to enable for `@babel/parser`, which is used to
   * parse expressions in bindings and interpolations.
   * https://babeljs.io/docs/en/next/babel-parser#plugins
   */
  expressionPlugins?: ParserPlugin[]
  /**
   * 单文件组件 scoped style ID
   * */
  scopeId?: string | null
  /**
   * SFC `<style vars>` injection string
   * Should already be an object expression, e.g. `{ 'xxxx-color': color }`
   * needed to render inline CSS variables on component root
   */
  ssrCssVars?: string
  onError?: (error: CompilerError) => void

}

export interface CodegenOptions extends SharedTransformCodegenOptions {
  /**
   * - `module` mode will generate ES module import statements for helpers
   * and export the render function as the default export.
   * - `function` mode will generate a single `const { helpers... } = Vue`
   * statement and return the render function. It expects `Vue` to be globally
   * available (or passed by wrapping the code with an IIFE). It is meant to be
   * used with `new Function(code)()` to generate a render function at runtime.
   * @default 'function'
   */
  mode?: 'module' | 'function'
  /**
   * 生成source map ?
   * @default false
   * */
  sourceMap?: boolean
  /**
   * source map 生成的 filename
   * @default `template.vue.html`
   * */
  filename?: string

  /**
   * SFC scopeid style ID
   * */
  scopeId?: string | null
  /**
   * Option to optimize helper import bindings via variable assignment
   * (only used for webpack code-split)
   * @default false
   */
  optimizedImports?: boolean
  /**
   * 自定义从哪里导入 runtime 帮助程序。
   * @default vue
   * */
  runtimeModuleName?: string

  /**
   * 自定义 "Vue "的全局变量名，以便在函数模式下获取 helpers。
   * @default `Vue`
   * */
  runtimeGlobalName?: string

}

export type CompilerOptions = ParserOptions & TransformOptions & CodegenOptions
