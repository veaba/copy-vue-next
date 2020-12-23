import {
    computed as _computed,
    ComputedGetter,
} from "@vue/reactivity";

export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>;

export function computed<T>(
    options: WritableComputedOptions<T>
): WritableComputedRef<T>
export function computed<T>(
    getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>
) {
    const c = _computed(getterOrOptions as any); // TODO:这里是什么意思？断言吗
    recordInstanceBoundEffect(c.effect); // TODO: 这个方法时干嘛？
    return c;
}


