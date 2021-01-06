import {isFunction, NOOP} from "../../shared/src/index.js";
import {TrackOpTypes, TriggerOpTypes} from "./operations.js";
import {ReactiveEffect, track, trigger, effect} from "./effect.js";
import {ReactiveFlags, toRaw} from './reactive.js'
import {Ref} from "./ref.js";


export interface WritableComputedOptions<T> {
    get: ComputedGetter<T>
    set: ComputedSetter<T>
}


export type ComputedGetter<T> = (ctx?: any) => T;
export type ComputedSetter<T> = (v: T) => void;

export interface WritableComputedOptions<T> {
    get: ComputedGetter<T>
    set: ComputedSetter<T>
}

export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>

export function computed<T>(options: WritableComputedOptions<T>): WritableComputedRef<T>

export function computed<T>(
    getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>
) {
    let getter: ComputedGetter<T>
    let setter: ComputedSetter<T>

    if (isFunction(getterOrOptions)) {
        getter = getterOrOptions
        setter = __DEV__ ? () => {
            console.warn("写入操作失败：computed 值只读")
        } : NOOP
    } else {
        getter = getterOrOptions.get
        setter = getterOrOptions.set
    }

    return new ComputedRefImpl(
        getter,
        setter,
        isFunction(getterOrOptions) || !getterOrOptions.set
    ) as any
}


export interface WritableComputedRef<T> extends Ref<T> {
    readonly effect: ReactiveEffect<T>;
}

export interface ComputedRef<T = any> extends WritableComputedRef<T> {
    readonly value: T;
}


// Computed响应式实现的类
class ComputedRefImpl<T> {
    private _value!: T // TODO：这种写法是什么意思？
    private _dirty: boolean // 脏数据检查

    public readonly effect: ReactiveEffect<T>
    public readonly __v_isRef = true
    public readonly [ReactiveFlags.IS_READONLY]: boolean

    constructor(
        getter: ComputedGetter<T>,
        private readonly _setter: ComputedSetter<T>,
        isReadonly: boolean
    ) {
        this._dirty = true
        this.effect = effect(getter, {
            lazy: true,
            // 调度员
            scheduler: () => {
                if (!this._dirty) {
                    this._dirty = true
                    trigger(toRaw(this), TriggerOpTypes.SET, 'value')
                }
            }
        })
        this[ReactiveFlags.IS_READONLY] = isReadonly
    }

    get value() {
        if (this._dirty) {
            this._value = this.effect()
            this._dirty = false
        }
        track(toRaw(this), TrackOpTypes.GET, 'value')
        return this._value
    }

    set value(newValue) {
        this._setter(newValue)
    }
}

