export interface CompilerError extends SyntaxError {
  code: number | string
  loc?: SourceLocation
}


// The node's range. The `start` is inclusive and `end` is exclusive.
// [start, end)
export interface SourceLocation {
  start: Position
  end: Position
  source: string
}

export interface ErrorHandlingOptions {
  onWarn?: (warning: CompilerError) => void
  onError?: (error: CompilerError) => void
}

export interface ParserOptions
  extends ErrorHandlingOptions,
    CompilerCompatOptions {
  /**
   * Base mode is platform agnostic and only parses HTML-like template syntax,
   * treating all tags the same way. Specific tag parsing behavior can be
   * configured by higher-level compilers.
   *
   * HTML mode adds additional logic for handling special parsing behavior in
   * `<script>`, `<style>`,`<title>` and `<textarea>`.
   * The logic is handled inside compiler-core for efficiency.
   *
   * SFC mode treats content of all root-level tags except `<template>` as plain
   * text.
   */
  parseMode?: 'base' | 'html' | 'sfc'
  /**
   * Specify the root namespace to use when parsing a template.
   * Defaults to `Namespaces.HTML` (0).
   */
  ns?: Namespaces
  /**
   * e.g. platform native elements, e.g. `<div>` for browsers
   */
  isNativeTag?: (tag: string) => boolean
  /**
   * e.g. native elements that can self-close, e.g. `<img>`, `<br>`, `<hr>`
   */
  isVoidTag?: (tag: string) => boolean
  /**
   * e.g. elements that should preserve whitespace inside, e.g. `<pre>`
   */
  isPreTag?: (tag: string) => boolean
  /**
   * Elements that should ignore the first newline token per parinsg spec
   * e.g. `<textarea>` and `<pre>`
   */
  isIgnoreNewlineTag?: (tag: string) => boolean
  /**
   * Platform-specific built-in components e.g. `<Transition>`
   */
  isBuiltInComponent?: (tag: string) => symbol | void
  /**
   * Separate option for end users to extend the native elements list
   */
  isCustomElement?: (tag: string) => boolean | void
  /**
   * Get tag namespace
   */
  getNamespace?: (
    tag: string,
    parent: ElementNode | undefined,
    rootNamespace: Namespace,
  ) => Namespace
  /**
   * @default ['{{', '}}']
   */
  delimiters?: [string, string]
  /**
   * Whitespace handling strategy
   * @default 'condense'
   */
  whitespace?: 'preserve' | 'condense'
  /**
   * Only used for DOM compilers that runs in the browser.
   * In non-browser builds, this option is ignored.
   */
  decodeEntities?: (rawText: string, asAttr: boolean) => string
  /**
   * Whether to keep comments in the templates AST.
   * This defaults to `true` in development and `false` in production builds.
   */
  comments?: boolean
  /**
   * Parse JavaScript expressions with Babel.
   * @default false
   */
  prefixIdentifiers?: boolean
  /**
   * A list of parser plugins to enable for `@babel/parser`, which is used to
   * parse expressions in bindings and interpolations.
   * https://babeljs.io/docs/en/next/babel-parser#plugins
   */
  expressionPlugins?: ParserPlugin[]
}
