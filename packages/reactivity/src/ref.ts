declare const RefSymbol: unique symbol;  // TODO: unique?
export interface Ref<T = any> {
    value: T;

    [RefSymbol]: true;
    /**
     * @internal
     * */
    _shallow?: boolean;
}


export function isRef<T>(r: Ref<T> | unknown): r is Ref<T>

export function isRef(r: any): r is Ref {
    return Boolean(r && r.__v_isRef)
}
