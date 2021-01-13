// Vue模板是一个与平台无关的HTML超集（仅限语法）。
// 更多的 namespace（如SVG和MathML）是由特定于平台的编译器声明的。
import { ForParseResult } from './vFor'
import { FRAGMENT, RENDER_LIST } from './runtimeHelpers'
import { DirectiveArguments, VNode } from '@vue/runtime-core'
import { ImportItem } from './transform'

export type Namespace = number

export const enum ElementTypes {
  ELEMENT,
  COMPONENT,
  SLOT,
  TEMPLATE
}

export const enum NodeTypes {
  ROOT,
  ELEMENT,
  TEXT,
  COMMENT,
  SIMPLE_EXPRESSION,
  INTERPOLATION, /* 插值*/
  ATTRIBUTE,
  DIRECTIVE,

  // containers
  COMPOUND_EXPRESSION,
  IF,
  IF_BRANCH,
  FOR,
  TEXT_CALL,

  // codegen
  VNODE_CALL,
  JS_CALL_EXPRESSION,
  JS_OBJECT_EXPRESSION,
  JS_PROPERTY,
  JS_ARRAY_EXPRESSION,
  JS_FUNCTION_EXPRESSION,
  JS_CONDITIONAL_EXPRESSION,
  JS_CACHE_EXPRESSION,

  // ssr codegen
  JS_BLOCK_STATEMENT,
  JS_TEMPLATE_LITERAL,
  JS_IF_STATEMENT,
  JS_ASSIGNMENT_EXPRESSION,
  JS_SEQUENCE_EXPRESSION,
  JS_RETURN_STATEMENT

}

export interface TextNode extends Node {
  type: NodeTypes.TEXT
  content: string
}

export interface AttributeNode extends Node {
  type: NodeTypes.ATTRIBUTE
  name: string
  value: TextNode | undefined
}

export interface RootNode extends Node {
  type: NodeTypes.ROOT
  children: TemplateChildNode[]
  helpers: symbol[]
  components: string[]
  directives: string[]
  hoists: (JSChildNode | null)[]
  imports: ImportItem[]
  cached: number
  temps: number
  sshHelpers?: symbol[]
  codegenNode?: TemplateChildNode | JSChildNode | BlockStatement | undefined
}

export interface SimpleExpressionNode extends Node {
  type: NodeTypes.SIMPLE_EXPRESSION
  content: string
  isStatic: boolean
  constType: ConstantTypes
  /**
   * 指示这是提升vnode调用的标识符，并指向提升节点。
   * */
  hoisted?: JSChildNode
  /**
   * 解析为函数参数的表达式将跟踪在函数bod中声明的标识符
   * */
  identifiers?: string[]
}

export interface CompoundExpressionNode extends Node {
  type: NodeTypes.COMPOUND_EXPRESSION
  children: (
    | SimpleExpressionNode
    | CompoundExpressionNode
    | InterpolationNode
    | TextNode
    | string
    | symbol)[]
  /**
   * 解析为函数参数的表达式将跟踪函数体中声明的标识符。
   * */
  identifiers?: string[]
}

export type  ExpressionNode = SimpleExpressionNode | CompoundExpressionNode

export interface VNodeCall extends Node {
  type: NodeTypes.VNODE_CALL
  tag: string | symbol | CallExpression
  props: PropsExpression | undefined
  children:
    | TemplateChildNode[]  // 多个children
    | TemplateTextChildNode // 单个text child
    | SlotsExpression  // component slots
    | ForRenderListExpression // v-for fragment call
    | undefined
  patchFlag: string | undefined
  dynamicProps: string | undefined
  directives: DirectiveArguments | undefined
  isBlock: boolean
  disabledTracking: boolean
}


export interface DirectiveNode extends Node {
  type: NodeTypes.DIRECTIVE
  name: string
  exp: ExpressionNode | undefined
  arg: ExpressionNode | undefined
  modifiers: string[]
  // 用于缓存v-for的表达式分析结果的可选属性
  parseResult?: ForParseResult
}

export interface BaseElementNode extends Node {
  type: NodeTypes.ELEMENT
  ns: Namespace
  tag: string
  tagType: ElementTypes
  isSelfClosing: Boolean
  props: Array<AttributeNode | DirectiveNode>
  children: TemplateChildNode[]
}

export interface PlainElementNode extends BaseElementNode {
  tagType: ElementTypes.ELEMENT
}

export interface ComponentNode extends BaseElementNode {
  typeType: ElementTypes.COMPONENT
  codegenNode:
    | VNodeCall
    | CacheExpression // 当通过 `v-once` 缓存
    | undefined
  ssrCodegenNode?: CallExpression
}

export interface SlotOutletNode extends BaseElementNode {
  tagType: ElementTypes.SLOT
  codegenNode:
    | RenderSlotCall
    | CacheExpression // 当通过 `v-once`  缓存
    | undefined
  ssrCodegenNode?: CallExpression
}

export interface ComponentNode extends BaseElementNode {
  tagType: ElementTypes.COMPONENT
  codegenNode:
    | VNodeCall
    | CacheExpression // 当通过 `v-once`  缓存
    | undefined
  ssrCodegenNode?: CallExpression
}


export interface TemplateNode extends BaseElementNode {
  tagType: ElementTypes.TEMPLATE
  // TemplateNode是一种容器类型，它总是被编译掉
  codegenNode: undefined
}

export interface InterpolationNode extends Node {
  type: NodeTypes.INTERPOLATION
  content: ExpressionNode
}

export interface IfNode extends Node {
  type: NodeTypes.IF
  branches: IfBranchNode[]
  codegenNode?: IfConditionalExpression | CacheExpression // <div v-if v-once>
}

export interface IfBranchNode extends Node {
  type: NodeTypes.IF_BRANCH
  condition: ExpressionNode | undefined // else
  children: TemplateChildNode[]
  userKey?: AttributeNode | DirectiveNode
}

export interface TextCallNode extends Node {
  type: NodeTypes.TEXT_CALL
  content: TextNode | InterpolationNode | CompoundExpressionNode
  codegenNode: CallExpression | SimpleExpressionNode // 当 hoisted
}


// JS Node Types ---------------------------------------------------------------

// 我们还包括一些JavaScript AST节点用于代码生成。
// AST是一个故意的最小子集，只是为了满足Vue渲染函数生成的确切需要。
export type JSChildNode =
  | VNodeCall
  | CallExpression
  | ObjectExpression
  | ArrayExpression
  | EexpressionNode
  | FunctionExpression
  | ConditionalExpression
  | AssignmentExpression
  | SequenceExpression


export interface CacheExpression extends Node {
  type: NodeTypes.JS_CACHE_EXPRESSION
  index: number
  value: JSChildNode
  isVNode: boolean
}


// SSR指定 Node Type ------------------------------------------------------------
export type SSRCodegenNode =
  | BlockStatement
  | TemplateLiternal
  | IfStatement
  | AssignmentExpression
  | ReturnStatement
  | SequenceExpression

export interface CallExpression extends Node {
  type: NodeTypes.JS_CALL_EXPRESSION
  callee: string | symbol
  arguments: (
    | string
    | symbol
    | JSChildNode
    | SSRCodegenNode
    | TemplateChildNode
    | TemplateChildNode [])[]
}

export interface ForIteratorExpression extends CallExpression {
  callee: typeof RENDER_LIST
  arguments: [ExpressionNode, ForIteratorExpression]
}

export interface ForRenderListExpression extends CallExpression {
  callee: typeof RENDER_LIST
  arguments: [ExpressionNode, ForIteratorExpression]
}

export interface ForCodegenNode extends VNodeCall {
  isBlock: true
  tag: typeof FRAGMENT
  props: undefined
  children: ForRenderListExpression
  patchFlag: string
  disableTracking: boolean
}

export interface ForNode extends Node {
  type: NodeTypes.FOR
  source: ExpressionNode
  valueAlias: ExpressionNode | undefined
  keyAlias: ExpressionNode | undefined
  objectIndexAlias: ExpressionNode | undefined
  parserResult: ForParseResult
  children: TemplateChildNode[]
  codegenNode?: ForCodegenNode
}

export type  ElementNode =
  | PlainElementNode
  | ComponentNode
  | SlotOutletNode
  | TemplateNode

export type TemplateChildNode =
  | ElementNode
  | InterpolationNode
  | CompoundExpressionNode
  | TextNode
  | ComponentNode
  | IfNode
  | IfBranchNode
  | ForNode
  | TextCallNode

export type ParentNode = RootNode | ElementNode | IfBranchNode | ForNode
