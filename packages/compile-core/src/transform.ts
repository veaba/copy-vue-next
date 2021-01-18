import {
  CacheExpression, DirectiveNode, ElementNode,
  ExpressionNode,
  JSChildNode,
  ParentNode, Property,
  RootNode,
  SimpleExpressionNode,
  TemplateChildNode, TemplateLiteral
} from './ast'
import { TransformOptions } from './options'

export interface ImportItem {
  exp: string | ExpressionNode
  path: string
}


export interface TransformContext extends Required<TransformOptions> {
  root: RootNode
  helpers: Set<symbol>
  components: Set<string>
  directives: Set<string>
  hoists: (JSChildNode | null)[]
  imports: Set<ImportItem>
  temps: number
  cached: number
  identifiers: { [name: string]: number | undefined }
  scopes: {
    vFor: number
    vSlot: number
    vPre: number
    vOnce: number
  }
  parent: ParentNode | null
  childIndex: number
  currentNode: RootNode | TemplateChildNode | null

  helper<T extends symbol>(name: T): T

  helperString(name: symbol): string

  replaceNode(node?: TemplateChildNode): void

  onNodeRemoved(): void

  addIdentifiers(exp: ExpressionNode | string): void

  removeIdentifiers(exp: ExpressionNode | string): void

  hoist(exp: JSChildNode): SimpleExpressionNode

  cache<T extends JSChildNode>(exp: T, isNode?: boolean): CacheExpression | T
}

export interface DirectiveTransformResult {
  props: Property[]
  needRuntime?: boolean | symbol
  ssrTagParts?: TemplateLiteral['elements']
}

export type NodeTransform = (
  node: RootNode | TemplateChildNode,
  context: TransformContext
) => void | (() => void) | (() => void)[]

// - DirectiveTransforms
// 处理元素上单个指令属性的 transform
// 它将原始指令转化为VNode的实际 prop。
export type DirectiveTransforms = (
  dir: DirectiveNode,
  node: ElementNode,
  context: TransformContext,
  // 特定平台的编译器可以通过传递这个可选参数来导入基础变换并对其进行增强。
  augmentor?: (ret: DirectiveTransformResult) => DirectiveTransformResult
) => DirectiveTransformResult
