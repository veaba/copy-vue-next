import {
    computed as _computed,
    ComputedGetter,
    ComputedRef,
    WritableComputedOptions,
    WritableComputedRef
} from "@vue/reactivity";
import {recordInstanceBoundEffect} from "./component";


// TODO：以下两个声明都在compute.ts 中写过，但为什么这里要重复呢？
export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>;

export function computed<T>(
    options: WritableComputedOptions<T>
): WritableComputedRef<T>;
export function computed<T>(
    getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>
) {
    const c = _computed(getterOrOptions as any);
    recordInstanceBoundEffect(c.effect); // TODO: 这个方法时干嘛？
    return c;
}
