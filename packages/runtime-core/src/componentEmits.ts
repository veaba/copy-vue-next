import {ComponentInternalInstance, ConcreteComponent} from "./component";
import {AppContext} from "./apiCreateApp";
import {camelize, EMPTY_OBJ, isFunction, toHandlerKey, toNumber} from "@vue/shared";
import {warn} from "./warning";

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
    // todo
}

export function emit(
    instance: ComponentInternalInstance,
    event: string,
    ...rawArgs: any[]
) {
    if (__DEV__) {
        const {
            emitsOptions,
            propsOptions: [propsOptions]
        } = instance
        if (emitsOptions) {
            if (!(event in emitsOptions)) {
                if (!propsOptions || !(toHandlerKey(event) in propsOptions)) {
                    warn(
                        `Component emitted event "${event}" but it is neither declared in ` +
                        `the emits option nor as an "${toHandlerKey(event)}" prop.`
                    )
                }
            } else {
                const validator = emitsOptions[event]
                if (isFunction(validator)) {
                    const isValid = validator(...rawArgs)
                    if (!isValid) {
                        warn(
                            `Invalid event arguments: event validation failed for event "${event}".`
                        )
                    }
                }
            }
        }
    }

    // TODO: 更改了原版的声明位置
    const props = instance.vnode.props || EMPTY_OBJ
    let args = rawArgs
    const isModelListener = event.startsWith('update:')

    // 对于 v-model update:xxx 事件，在 args 上应用修饰符
    const modelArg = isModelListener && event.slice(7)
    if (modelArg && modelArg in props) {
        const modifiersKey = `${
            modelArg === 'modelValue' ? 'model' : modelArg
        }Modifiers`
        const {number, trim} = props[modifiersKey] || EMPTY_OBJ
        if (trim) {
            args = rawArgs.map(a => a.trim())
        } else if (number) {
            args = rawArgs.map(toNumber)
        }
    }

    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        devtoolsComponentEmit(instance, event, args)
    }

    if (__DEV__) {
        const lowerCaseEvent = event.toLowerCase()
        if (lowerCaseEvent !== event && props[toHandlerKey(lowerCaseEvent)]) {
            warn(
                `Event "${lowerCaseEvent}" is emitted in component ` +
                `${formatComponentName(
                    instance,
                    instance.type
                )} but the handler is registered for "${event}". ` +
                `Note that HTML attributes are case-insensitive and you cannot use ` +
                `v-on to listen to camelCase events when using in-DOM templates. ` +
                `You should probably use "${hyphenate(event)}" instead of "${event}".`
            )
        }
    }

    // 转换 handler 名词到 camelCase，see issue #2249
    let handlerName = toHandlerKey(camelize(event))
    let handler = props[handlerName]

    // 对于 v-model update:xxx 事件，也触发 kebab-case 对等
    // 通过 kebab-case  传递的props
    if (!handler && isModelListener) {
        handlerName = toHandlerKey(hyphenate(event))
        handler = props[handlerName]
    }
    if (handler) {
        callWithAsyncErrorHandling(
            handler,
            instance,
            ErrorCodes.COMPONENT_EVENT_HANDLER,
            args
        )
    }

    const onceHandler = props[handlerName + 'Once']
    if (onceHandler) {
        if (!instance.emitted) {
            ;(instance.emitted = {} as Record<string, boolean>)[handlerName] = true;
        } else if (instance.emitted[handlerName]) {
            return;
        }
        callWithAsyncErrorHandling(
            onceHandler,
            instance,
            errorCodes.COMPONENT_EVENT_HANDLER,
            args
        )
    }
}
