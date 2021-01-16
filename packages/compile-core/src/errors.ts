import { SourceLocation } from './ast'

export interface CompilerError extends SyntaxError {
  code: number,
  loc?: SourceLocation
}
