import { VNode } from './vnode'

export type  RootHydrateFunction = (
  vnode: VNode<Node, Element>,
  container: Element
) => void
