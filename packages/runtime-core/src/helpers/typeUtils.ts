export type UnionToIntersection<U>=(U extends any

    ? (k:U)=>void
    : never)
