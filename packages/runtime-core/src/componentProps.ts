import { ComponentOptions } from './componentOptions'
import { ComponentInternalInstance, ConcreteComponent, Data, setCurrentInstance } from './component'
import { warn } from './warning'
import { AppContext } from './apiCreateApp'
import {
  camelize, capitalize,
  def,
  EMPTY_ARR,
  EMPTY_OBJ,
  extend,
  hasOwn, hyphenate,
  isArray,
  isFunction,
  isObject, isReservedProp,
  isString, toRawType
} from '@vue/shared'
import { InternalObjectKey } from './vnode'
import { shallowReactive, toRaw } from '@vue/reactivity'
import { isEmitListener } from './componentEmits'
import { makeMap } from '../../shared/src/makeMap'


export type ComponentPropsOptions<P = Data> =
  | ComponentObjectPropsOptions<P>
  | string[]

type PropMethod<T, TConstructor = any> = T extends (...args: any) => any // 如果是带 args 的函数
  ? { new(): TConstructor; (): T; readonly prototype: TConstructor } // 像构造函数一样创建函数
  : never

type PropConstructor<T = any> = | { new(...args: any[]): T & object } | { (): T } | PropMethod<T>
export type PropType<T> = PropConstructor<T> | PropConstructor<T>[]

type DefaultFactory<T> = (props: Data) => T | null | undefined

// diff: 因与 ComponentOptions.ts 重复，所以这里公开
export interface PropOptions<T = any, D = T> {
  type?: PropType<T> | true | null
  required?: boolean
  default?: D | DefaultFactory<D> | null | undefined | object

  validator?(value: unknown): boolean
}

export enum BooleanFlags {
  shouldCast = 0,
  shouldCastTrue = 1
}


type NormalizedProp =
  | null
  | (PropOptions & {
  [BooleanFlags.shouldCast]?: boolean
  [BooleanFlags.shouldCastTrue]?: boolean
})

export type Prop<T, D = T> = PropOptions<T, D> | PropType<T>
export type ComponentObjectPropsOptions<P = Data> = {
  [K in keyof P]: Prop<P[K]> | null
}

type InferPropType<T> = T extends null
  ? any // null & true would fail to infer
  : T extends { type: null | true }
    ? any // As TS issue https://github.com/Microsoft/TypeScript/issues/14829 // somehow `ObjectConstructor` when inferred from { (): T } becomes `any` // `BooleanConstructor` when inferred from PropConstructor(with PropMethod) becomes `Boolean`
    : T extends ObjectConstructor | { type: ObjectConstructor }
      ? Record<string, any>
      : T extends BooleanConstructor | { type: BooleanConstructor }
        ? boolean
        : T extends Prop<infer V, infer D> ? (unknown extends V ? D : V) : T

type RequiredKeys<T> = {
  [K in keyof T]: T[K] extends | { required: true }
    | { default: any }
    // don't mark Boolean props as undefined
    | BooleanConstructor
    | { type: BooleanConstructor }
    ? K
    : never
}[keyof T]

type OptionalKeys<T> = Exclude<keyof T, RequiredKeys<T>>

type DefaultKeys<T> = {
  [K in keyof T]: T[K] extends | { default: any }
    // Boolean implicitly defaults to false
    | BooleanConstructor
    | { type: BooleanConstructor }
    ? T[K] extends { type: BooleanConstructor; required: true } // 如果将布尔值标记为必填项，则不是默认值
      ? never
      : K
    : never
}[keyof T]

export type ExtractPropTypes<O> = O extends object ?
  { [K in RequiredKeys<O>]: InferPropType<O[K]> } &
  { [K in OptionalKeys<O>]?: InferPropType<O[K]> } :
  { [K in string]: any }

// 从 prop 选项中提取默认定义的prop
export type ExtractDefaultPropTypes<O> = O extends object ? {
  [K in DefaultKeys<O>]: InferPropType<O[K]>
} : {}

// normalized value is a tuple of the actual normalized options
// and an array of prop keys that need value casting (booleans and defaults)
export type NormalizedProps = Record<string, NormalizedProp>
export type NormalizedPropsOptions = [NormalizedProps, string[]] | []

function validatePropName(key: string): boolean {
  if (key[0] !== '$') {
    return true
  } else if (__DEV__) {
    warn(`Invalid prop name: "${key}" is a reserved property.`)
  }
  return false
}

// 使用函数字符串名称来检查类型构造函数，这样它就可以跨vms/iframes工作。
function getType(ctor: Prop<any>): string {
  const match = ctor && ctor.toString().match(/^\s*function (\w+)/)
  return match ? match[1] : ''
}

function isSameType(a: Prop<any>, b: Prop<any>): boolean {
  return getType(a) === getType(b)
}

function getTypeIndex(
  type: Prop<any>,
  expectedTypes: PropType<any> | void | null | true
): number {
  if (isArray(expectedTypes)) {
    for (let i = 0, len = expectedTypes.length; i < len; i++) {
      if (isSameType(expectedTypes[i], type)) {
        return i
      }
    }
  } else if (isFunction(expectedTypes)) {
    return isSameType(expectedTypes, type) ? 0 : -1
  }
  return -1
}

export function normalizePropsOptions(
  comp: ConcreteComponent,
  appContext: AppContext,
  asMixin = false
): NormalizedPropsOptions {
  if (!appContext.deopt && comp.__props) {
    return comp.__props
  }
  const raw = comp.props
  const normalized: NormalizedPropsOptions[0] = {}
  const needCastKeys: NormalizedPropsOptions[1] = []

  // 应用 mixin/extends props
  let hasExtends = false
  if (__FEATURE_OPTIONS_API__ && !isFunction(comp)) {
    const extendProps = (raw: ComponentOptions) => {
      hasExtends = true
      const [props, keys] = normalizePropsOptions(raw, appContext, true)
      extend(normalized, props)
      if (keys) needCastKeys.push(...keys)
    }

    if (!asMixin && appContext.mixins.length) {
      appContext.mixins.forEach(extendProps)
    }
    if (comp.extends) {
      extendProps(comp.extends)
    }
    if (comp.mixins) {
      comp.mixins.forEach(extendProps)
    }
  }

  if (!raw && !hasExtends) {
    return (comp.__props = EMPTY_ARR as any)
  }

  if (isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      if (__DEV__ && !isString(raw[i])) {
        warn(`props must be strings when using array syntax.`, raw[i])
      }
      const normalizedKey = camelize(raw[i])
      if (validatePropName(normalizedKey)) {
        normalized[normalizedKey] = EMPTY_OBJ
      }
    }
  } else if (raw) {
    if (__DEV__ && !isObject(raw)) {
      warn(`invalid props options`, raw)
    }
    for (const key in raw) {
      if (!raw.hasOwnProperty(key)) continue
      const normalizedKey = camelize(key)
      if (validatePropName(normalizedKey)) {
        const opt = raw[key]
        const prop: NormalizedProp = (normalized[normalizedKey] =
          isArray(opt) || isFunction(opt) ? { type: opt } : opt)
        if (prop) {
          const booleanIndex = getTypeIndex(Boolean, prop.type)
          const stringIndex = getTypeIndex(String, prop.type)
          prop[BooleanFlags.shouldCast] = booleanIndex > -1
          prop[BooleanFlags.shouldCastTrue] = stringIndex < 0 || booleanIndex < stringIndex

          //  如果该 prop 需要 boolean 固定或默认值
          if (booleanIndex > -1 || hasOwn(prop, 'default')) {
            needCastKeys.push(normalizedKey)
          }
        }
      }
    }
  }
  return (comp.__props = [normalized, needCastKeys])
}

function resolvePropValue(
  options: NormalizedProps,
  props: Data,
  key: string,
  value: unknown,
  instance: ComponentInternalInstance
) {
  const opt = options[key]
  if (opt != null) {
    const hasDefault = hasOwn(opt, 'default')
    // default values
    if (hasDefault && value === undefined) {
      const defaultValue = opt.default
      if (opt.type !== Function && isFunction(defaultValue)) {
        setCurrentInstance(instance)
        value = defaultValue(props)
        setCurrentInstance(null)
      } else {
        value = defaultValue
      }
    }
    // boolean casting
    if (opt[BooleanFlags.shouldCast]) {
      if (!hasOwn(props, key) && !hasDefault) {
        value = false
      } else if (
        opt[BooleanFlags.shouldCastTrue] &&
        (value === '' || value === hyphenate(key))
      ) {
        value = true
      }
    }
  }
  return value
}

function setFullProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  props: Data,
  attrs: Data
) {
  const [options, needCastKeys] = instance.propsOptions
  if (rawProps) {
    for (const key in rawProps) {
      const value = rawProps[key]
      // key,ref是保留的，永远不会传递下去
      if (isReservedProp(key)) {
        continue
      }
      // 属性选项名称在规范化过程中是驼峰的，
      // 所以为了支持kebab->camel转换，我们需要驼峰key。
      let camelKey
      if (options && hasOwn(options, (camelKey = camelize(key)))) {
        props[camelKey] = value
      } else if (!isEmitListener(instance.emitsOptions, key)) {
        //任何未声明的（作为prop或已发出的事件）prop都将被放置
        //到一个单独的“attrs”对象中进行传播。一定要保存
        // 原始 key 套件
        attrs[key] = value
      }
    }
  }
  if (needCastKeys) {
    const rawCurrentProps = toRaw(props)
    for (let i = 0; i < needCastKeys.length; i++) {
      const key = needCastKeys[i]
      props[key] = resolvePropValue(
        options!,
        rawCurrentProps,
        key,
        rawCurrentProps[key],
        instance
      )
    }
  }
}

const isSimpleType = /*#__PURE__*/ makeMap(
  'String,Number,Boolean,Function,Symbol'
)

type AssertionResult = {
  valid: boolean
  expectedType: string
}

/**
 * dev only
 * */
function assertType(value: unknown, type: PropConstructor): AssertionResult {
  let valid
  const expectedType = getType(type)
  if (isSimpleType(expectedType)) {
    const t = typeof value
    valid = t === expectedType.toLowerCase()

    // 用于原始包装对象
    if (!valid && t === 'object') {
      valid = value instanceof type
    }
  } else if (expectedType === 'Object') {
    valid = isObject(value)
  } else if (expectedType === 'Array') {
    valid = isArray(value)
  } else {
    valid = value instanceof type
  }
  return {
    valid, expectedType
  }
}

/**
 * dev only
 * */
function isExplicable(type: string): boolean {
  const expectedTypes = ['string', 'number', 'boolean']
  return expectedTypes.some(elem => type.toLowerCase() === elem)
}

/**
 * dev only
 * */
function isBoolean(...args: string[]): boolean {
  return args.some(elem => elem.toLowerCase() === 'boolean')
}

/**
 * dev only
 * */
function styleValue(value: unknown, type: string): string {
  if (type === 'String') {
    return `"${value}"`
  } else if (type === 'Number') {
    return `${Number(value)}`
  } else {
    return `${value}`
  }
}

/**
 * dev only
 * */
function getInvalidTypeMessage(
  name: string,
  value: unknown,
  expectedTypes: string[]
): string {
  let message =
    `Invalid prop: type check failed for prop "${name}"` +
    ` Expected ${expectedTypes.map(capitalize).join(', ')}`
  const expectedType = expectedTypes[0]
  const receivedType = toRawType(value)
  const expectedValue = styleValue(value, expectedType)
  const receivedValue = styleValue(value, receivedType)

  // 检查是否需要指定预期值
  if (
    expectedTypes.length === 1 &&
    isExplicable(expectedType) &&
    !isBoolean(expectedType, receivedType)
  ) {
    message += ` with value ${expectedValue}`
  }
  message += `, got ${receivedType} `
  // 检查是否需要指定接收值
  if (isExplicable(receivedType)) {
    message += `with value ${receivedValue}.`
  }
  return message
}

/**
 * dev only
 * */
function validateProp(
  name: string,
  value: unknown,
  prop: PropOptions,
  isAbsent: boolean
) {
  const { type, required, validator } = prop
  // required!
  if (required && isAbsent) {
    warn(`Missing required prop: "${name}"`)
    return
  }
  // 缺少但可选
  if (value == null && !prop.required) {
    return
  }

  // type check
  if (type != null && type !== true) {
    let isValid = false
    const types = isArray(type) ? type : [type]
    const expectedTypes = []

    // 只要指定的类型之一符合，该值就有效。
    for (let i = 0; i < types.length && !isValid; i++) {
      const { valid, expectedType } = assertType(value, types[i])
      expectedTypes.push(expectedType || '')
      isValid = valid
    }
    if (!isValid) {
      warn(getInvalidTypeMessage(name, value, expectedTypes))
      return
    }
  }

  // 自定义 validator
  if (validator && !validator(value)) {
    warn(`Invalid prop: custom validator check failed for prop "${name}".`)
  }
}

/**
 * dev only
 * */
function validateProps(props: Data, instance: ComponentInternalInstance) {
  const rawValues = toRaw(props)
  const options = instance.propsOptions[0]
  for (const key in options) {
    let opt = options[key]
    if (opt == null) continue
    validateProp(key, rawValues[key], opt, !hasOwn(rawValues, key))
  }
}

export function initProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  isStateful: number, // 位标记比较结果
  isSSR = false
) {
  const props: Data = {}
  const attrs: Data = {}
  def(attrs, InternalObjectKey, 1)
  setFullProps(instance, rawProps, props, attrs)
  // validation
  if (__DEV__) {
    validateProps(props, instance)
  }

  if (isStateful) {
    // stateful
    instance.props = isSSR ? props : shallowReactive(props)
  } else {
    if (!instance.type.props) {
      // functional w/ optional props, props === attrs
      instance.props = attrs
    } else {
      // functional w/ declared props
      instance.props = props
    }
  }
  instance.attrs = attrs
}

