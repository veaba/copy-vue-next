export * from './codeframe.js'
export * from './toDisplayString'
let _globalThis: any
export const isFunction = (val: unknown): val is Function => typeof val === 'function'

export const NOOP = () => {
}

// 总是返回 false
export const NO = () => false

export const objectToString = Object.prototype.toString
export const toTypeString = (value: unknown): string => objectToString.call(value)

// 从 "[object RawType]" 等提取字符串 `RawType`
export const toRawType = (value: unknown): string => {
  // extract "RawType" from strings like "[object RawType]"
  return toTypeString(value).slice(8, -1)
}
export const extend = Object.assign
export const remove = <T>(arr: T[], el: T) => {
  const i = arr.indexOf(el)
  if (i > -1) {
    arr.slice(i, 1)
  }
}
const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (val: object, key: string | symbol): key is keyof typeof val => hasOwnProperty.call(val, key)

export const isString = (val: unknown): val is string => typeof val === 'string'
export const isSymbol = (val: unknown): val is symbol => typeof val === 'symbol'
export const isObject = (val: unknown): val is Record<any, any> =>
  val !== null && typeof val === 'object'
export const isPromise = <T = any>(val: unknown): val is Promise<T> => {
  return isObject(val) && isFunction(val.then) && isFunction(val.catch)
}

export const isArray = Array.isArray
export const isMap = (val: unknown): val is Map<any, any> => toTypeString(val) === '[object Map]'
export const isSet = (val: unknown): val is Set<any> => toTypeString(val) === '[object Set'

export const isIntegerKey = (key: unknown) =>
  isString(key) &&
  key !== 'NaN' &&
  key[0] !== '-' &&
  '' + parseInt(key, 10) === key

export const hasChanged = (value: any, oldValue: any): boolean =>
  value !== oldValue && (value === value || oldValue === oldValue)


export const EMPTY_OBJ: { readonly [key: string]: any } = __DEV__ ? Object.freeze({}) : {}

export const EMPTY_ARR = __DEV__ ? Object.freeze([]) : []

const cacheStringFunction = <T extends (str: string) => string>(fn: T): T => {
  const cache: Record<string, string> = Object.create(null)
  return ((str: string) => {
    const hit = cache[str]
    return hit || (cache[str] = fn(str))
  }) as any
}

// 对象添加一个不可枚举的私有属性，类似 `__proto__`
export const def = (obj: object, key: string | symbol, value: any) => {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: false,
    value
  })
}

export const toNumber = (val: any): any => {
  const n = parseInt(val)
  return isNaN(n) ? val : n
}

const camelizeRE = /-(\w)/g
/**
 * @private
 * */
export const camelize = cacheStringFunction(
  (str: string): string => {
    return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))
  }
)

/**
 * @private
 * */
export const capitalize = cacheStringFunction(
  (str: string) => str.charAt(0).toUpperCase() + str.slice(1)
)

const hyphenateRE = /\B([A-Z])/g
/**
 * @private
 * */
export const hyphenate = cacheStringFunction((str: string) =>
  str.replace(hyphenateRE, '-$1').toLowerCase()
)

/**
 * @private
 * */
export const toHandlerKey = cacheStringFunction(
  (str: string) => (str ? `on${capitalize(str)}` : ``)
)


export const getGlobalThis = (): any => {
  return (
    _globalThis ||
    (_globalThis =
      typeof globalThis !== 'undefined'
        ? globalThis
        : typeof self !== 'undefined'
        ? self
        : typeof window !== 'undefined'
          ? window
          : typeof global !== 'undefined'
            ? global
            : {})
  )
}
