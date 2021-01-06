import {BooleanFlags} from "./componentOptions";
import {ConcreteComponent, Data} from "./component";
import {AppContext} from "./apiCreateApp";


type PropMethod<T, TConstructor = any> = T extends (...args: any) => any // 如果是带 args 的函数
    ? { new(): TConstructor; (): T; readonly prototype: TConstructor } // 像构造函数一样创建函数
    : never

type PropConstructor<T = any> = | { new(...args: any[]): T & object } | { (): T } | PropMethod<T>
export type PropType<T> = PropConstructor<T> | PropConstructor<T>[]

type DefaultFactory<T> = (props: Data) => T | null | undefined

// TODO: 因与 ComponentOptions.ts 重复，所以这里公开
export interface PropOptions<T = any, D = T> {
    type?: PropType<T> | true | null
    required?: boolean
    default?: D | DefaultFactory<D> | null | undefined | object

    validator?(value: unknown): boolean
}

type NormalizedProp = | null | (PropOptions & {
    [BooleanFlags.shouldCast]?: boolean
    [BooleanFlags.shouldCastTrue]?: boolean
})
export type NormalizedProps = Record<string, NormalizedProp>
export type NormalizedPropsOptions = [NormalizedProps, string[]] | []

export function normalizePropsOptions (
    comp:ConcreteComponent,
    appContext:AppContext,
    asMixin=false
):NormalizedPropsOptions{
    if(!appContext.deopt&&comp.__props){
        return comp.__props
    }
}
