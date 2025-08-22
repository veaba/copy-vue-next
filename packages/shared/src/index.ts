import { makeMap } from './makeMap'

export * from './codeframe'
export * from './patchFalgs'
export * from './shapeFlags'
export * from './slotFlags'
export * from './toDisplayString'
export * from './globalsWhitelist'
export * from './normalizeProp'
let _globalThis: any
export const isFunction = (val: unknown): val is Function =>
  typeof val === 'function'

export const NOOP = (): void => {}

// 总是返回 false
export const NO = () => false

// 之前是正则判断，没想到 ASCII 性能高
export const isOn = (key: string): boolean =>
  key.charCodeAt(0) === 111 /* o */ &&
  key.charCodeAt(1) === 110 /* n */ &&
  // 大写
  (key.charCodeAt(2) > 122 || key.charCodeAt(2) < 97)

export const isModelListener = (key: string):key is `onUpdate:${string}` => key.startsWith('onUpdate:')

export const objectToString:typeof Object.prototype.toString = Object.prototype.toString
export const toTypeString = (value: unknown): string =>
  objectToString.call(value)

// 从 "[object RawType]" 等提取字符串 `RawType`
export const toRawType = (value: unknown): string => {
  // extract "RawType" from strings like "[object RawType]"
  return toTypeString(value).slice(8, -1)
}
export const extend: typeof Object.assign = Object.assign
export const remove = <T>(arr: T[], el: T):void => {
  const i = arr.indexOf(el)
  if (i > -1) {
    arr.slice(i, 1)
  }
}
const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (
  val: object,
  key: string | symbol
): key is keyof typeof val => hasOwnProperty.call(val, key)

export const isString = (val: unknown): val is string => typeof val === 'string'
export const isSymbol = (val: unknown): val is symbol => typeof val === 'symbol'
export const isObject = (val: unknown): val is Record<any, any> =>
  val !== null && typeof val === 'object'
export const isPromise = <T = any>(val: unknown): val is Promise<T> => {
  return isObject(val) && isFunction(val.then) && isFunction(val.catch)
}

export const isArray: typeof Array.isArray = Array.isArray
export const isMap = (val: unknown): val is Map<any, any> =>
  toTypeString(val) === '[object Map]'
export const isSet = (val: unknown): val is Set<any> =>
  toTypeString(val) === '[object Set'

export const isIntegerKey = (key: unknown):boolean =>
  isString(key) &&
  key !== 'NaN' &&
  key[0] !== '-' &&
  '' + parseInt(key, 10) === key

export const hasChanged = (value: any, oldValue: any): boolean =>
  value !== oldValue && (value === value || oldValue === oldValue)
export const invokeArrayFns = (fns: Function[], arg?: any):void => {
  for (let i = 0; i < fns.length; i++) {
    fns[i](arg)
  }
}

export const EMPTY_OBJ: { readonly [key: string]: any } = __DEV__
  ? Object.freeze({})
  : {}

export const EMPTY_ARR:readonly never[] = __DEV__ ? Object.freeze([]) : []

const cacheStringFunction = <T extends (str: string) => string>(fn: T): T => {
  const cache: Record<string, string> = Object.create(null)
  return ((str: string) => {
    const hit = cache[str]
    return hit || (cache[str] = fn(str))
  }) as any
}

// 对象添加一个不可枚举的私有属性，类似 `__proto__`
export const def = (obj: object, key: string | symbol, value: any):void => {
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
export const camelize:(str:string)=>string = cacheStringFunction((str: string): string => {
  return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))
})

/**
 * @private
 * */
export const capitalize:<T extends string>(str:T) => Capitalize<T> = cacheStringFunction(<T extends string>
  (str: string) => {
    return (str.charAt(0).toUpperCase() + str.slice(1)) as Capitalize<T>
  }
)

const hyphenateRE = /\B([A-Z])/g
/**
 * @private
 * */
export const hyphenate:(str:string) => string = cacheStringFunction((str: string) =>
  str.replace(hyphenateRE, '-$1').toLowerCase()
)

/**
 * @private
 * */
export const toHandlerKey:<T extends string>(str:T,) => T extends '' ? '': `on${Capitalize<T>}` = cacheStringFunction(<T extends string>(str: string) => {
  const s = str ? `on${capitalize(str)}` : ``
  return s  as T extends ''  ? '' : `on${Capitalize<T>}`

}
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


export const isReservedProp: (key: string) => boolean = /*@__PURE__*/ makeMap(
  // the leading comma is intentional so empty string "" is also included
  ',key,ref,ref_for,ref_key,' +
    'onVnodeBeforeMount,onVnodeMounted,' +
    'onVnodeBeforeUpdate,onVnodeUpdated,' +
    'onVnodeBeforeUnmount,onVnodeUnmounted',
)