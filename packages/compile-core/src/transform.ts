import { ExpressionNode } from './ast'

export interface ImportItem {
  exp: string | ExpressionNode
  path: string
}
