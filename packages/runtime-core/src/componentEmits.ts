import {ConcreteComponent} from "./component";
import {AppContext} from "./apiCreateApp";

export type ObjectEmitsOptions = Record<string, ((...args: any[]) => any) | null>
export type EmitsOptions = ObjectEmitsOptions | string[]

export type EmitFn<Options = ObjectEmitsOptions,
    Event extends keyof Options = keyof Options> = Options extends Array<infer V>
    ? (event: V, ...args: any[]) => void
    : {} extends Options // 如果emit为空对象（通常emit的默认值），则应将其转换为函数
        ? (event: string, ...args: any[]) => void
        : UnionToIntersection<{
            [key in Event]: Options[key] extends ((...args: infer Args) => any)
                ? (event: key, ...args: Args) => void
                : (event: key, ...args: any[]) => void
        }[Event]>

export function normalizeEmitsOptions(
    comp: ConcreteComponent,
    appContext: AppContext,
    asMixin = false
): ObjectEmitsOptions | null {

}
