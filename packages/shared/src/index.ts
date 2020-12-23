export const isFunction = (val: unknown): val is Function => typeof val === 'function'


export const NOOP = () => {
}

export const objectToString = Object.prototype.toString
export const toTypeString = (value: unknown): string => objectToString.call(this)
const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (val: object, key: string | symbol): key is keyof typeof val => hasOwnProperty.call(val, key)

export const isString = (val: unknown): val is string => typeof val === 'string'
export const isSymbol = (val: unknown): val is symbol => typeof val === 'symbol'
export const isObject = (val: unknown): val is Record<any, any> =>
    val !== null && typeof val === 'object'

export const isArray = Array.isArray
export const isMap = (val: unknown): val is Map<any, any> => toTypeString(val) === '[object Map]'


export const isIntegerKey = (key: unknown) =>
    isString(key) &&
    key !== 'NaN' &&
    key[0] !== '-' &&
    '' + parseInt(key, 10) === key

export const hasChanged = (value: any, oldValue: any): boolean =>
    value !== oldValue && (value === value || oldValue === oldValue)


export const EMPTY_OBJ: { readonly [key: string]: any } = __DEV__ ? Object.freeze({}) : {}

