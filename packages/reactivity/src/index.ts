import { Ref } from "./ref";
export type ComputedGetter<T> = (ctx?: any) => T;
export type ComputedSetter<T> = (v: T) => void;

export interface ComputedRef<T = any> extends WritableComputedRef<T> {
  readonly value: T;
}

export interface WritableComputedRef<T> extends Ref<T> {
  readonly effect: ReactiveEffect<T>;
}
