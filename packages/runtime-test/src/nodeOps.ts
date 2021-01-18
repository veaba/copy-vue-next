import { markRaw } from '@vue/reactivity'


export const enum NodeTypes {
  TEXT = 'text',
  ELEMENT = 'element',
  COMMENT = 'comment'
}

export const enum NodeOpTypes {
  CREATE = 'create',
  INSERT = 'insert',
  REMOVE = 'remove',
  SET_TEXT = 'setText',
  SET_ELEMENT_TEXT = 'setElementText',
  PATCH = 'patch'
}

export interface TestElement {
  id: number
  type: NodeTypes.ELEMENT
  parentNode: TestElement | null
  tag: string
  children: TestNode[]
  props: Record<string, any>
  eventListeners: Record<string, Function | Function[]> | null
}

export interface TestText {
  id: number
  type: NodeTypes.TEXT
  parentNode: TestElement | null
  text: string
}


export interface TestComment {
  id: number
  type: NodeTypes.COMMENT
  parentNode: TestElement | null
  text: string
}

export type TestNode = TestElement | TestText | TestComment

export interface NodeOp {
  type: NodeOpTypes
  nodeType?: NodeTypes
  tag?: string
  text?: string
  targetNode?: TestNode
  parentNode?: TestElement
  refNode?: TestNode | null
  propKey?: string
  propPrevValue?: any
  propNextValue?: any
}

let nodeId: number = 0
let recordedNodeOps: NodeOp[] = []

export function logNodeOp(op: NodeOp) {
  recordedNodeOps.push(op)
}

function insert(child: TestNode, parent: TestElement, ref?: TestNode | null) {
  let refIndex
  if (ref) {
    refIndex = parent.children.indexOf(ref)
    if (refIndex === -1) {
      console.error(`ref: `, ref)
      console.error(`parent: `, parent)
      throw new Error(`ref is not a child of parent`)
    }
  }
  logNodeOp({
    type: NodeOpTypes.INSERT,
    targetNode: child,
    parentNode: parent,
    refNode: ref
  })
  // 首先删除节点，但不要将其记录为删除操作
  remove(child, false)
  // 重新计算ref索引，因为移除 children 可能会 effect 它
  refIndex = ref ? parent.children.indexOf(ref) : -1
  if (refIndex === -1) {
    parent.children.push(child)
    child.parentNode = parent
  } else {
    parent.children.splice(refIndex, 0, child)
    child.parentNode = parent
  }
}

function remove(child: TestNode, logOp: boolean = true) {
  const parent = child.parentNode
  if (parent) {
    if (logOp) {
      logNodeOp({
        type: NodeOpTypes.REMOVE,
        targetNode: child,
        parentNode: parent
      })
    }
    const i = parent.children.indexOf(child)
    if (i > -1) {
      parent.children.splice(i, 1)
    } else {
      console.error('target: ', child)
      console.error('parent: ', parent)
      throw Error('target is not a childNode of parent')
    }
    child.parentNode = null
  }
}

function createText(text: string): TestText {
  const node: TestText = {
    id: nodeId++,
    type: NodeTypes.TEXT,
    text,
    parentNode: null
  }
  logNodeOp({
    type: NodeOpTypes.CREATE,
    nodeType: NodeTypes.TEXT,
    targetNode: node,
    text
  })
  // 避免观察测试节点
  markRaw(node)
  return node
}

function createElement(tag: string): TestElement {
  const node: TestElement = {
    id: nodeId++,
    type: NodeTypes.ELEMENT,
    tag,
    children: [],
    props: {},
    parentNode: null,
    eventListeners: null
  }
  logNodeOp({
    type: NodeOpTypes.CREATE,
    nodeType: NodeTypes.ELEMENT,
    targetNode: node,
    tag
  })

  // 避免观察测试节点
  markRaw(node)
  return node
}

function createComment(text: string): TestComment {
  const node: TestComment = {
    id: nodeId++,
    type: NodeTypes.COMMENT,
    text,
    parentNode: null
  }
  logNodeOp({
    type: NodeOpTypes.CREATE,
    nodeType: NodeTypes.COMMENT,
    targetNode: node,
    text
  })
  // 避免观察测试节点
  markRaw(node)
  return node
}

function setText(node: TestText, text: string) {
  logNodeOp({
    type: NodeOpTypes.SET_TEXT,
    targetNode: node,
    text
  })
  node.text = text
}

function setElementText(el: TestElement, text: string) {
  logNodeOp({
    type: NodeOpTypes.SET_ELEMENT_TEXT,
    targetNode: el,
    text
  })
  el.children.forEach(c => {
    c.parentNode = null
  })
  if (!text) {
    el.children = []
  } else {
    el.children = [
      {
        id: nodeId++,
        type: NodeTypes.TEXT,
        text,
        parentNode: el
      }
    ]
  }
}

function parentNode(node: TestNode): TestElement | null {
  return node.parentNode
}

function nextSibling(node: TestNode): TestNode | null {
  const parent = node.parentNode
  if (!parent) {
    return null
  }
  const i = parent.children.indexOf(node)

  return parent.children[i + 1] || null
}

function querySelector(): any {
  throw new Error('querySelector not supported in test renderer.')
}

function setScopeId(el: TestElement, id: string) {
  el.props[id] = ''
}

export const nodeOps = {
  insert,
  remove,
  createElement,
  createText,
  createComment,
  setText,
  setElementText,
  parentNode,
  nextSibling,
  querySelector,
  setScopeId
}
