import {ComponentInternalInstance} from "./component";
import {App} from "./apiCreateApp";

const enum DevtoolsHooks {
    APP_INIT = 'app:init',
    APP_UNMOUNT = 'app:unmount',
    COMPONENT_UPDATED = 'component:updated',
    COMPONENT_ADDED = 'component:added',
    COMPONENT_REMOVED = 'component:removed',
    COMPONENT_EMIT = 'component:emit'
}

interface AppRecord {
    id: number,
    app: App,
    version: string
    types: Record<string, string | Symbol>
}

interface DevtoolsHook {
    emit: (event: string, ...payload: any[]) => void
    on: (event: string, handler: Function) => void
    once: (event: string, handler: Function) => void
    off: (event: string, handler: Function) => void
    appRecords: AppRecord[]
}

export let devtools: DevtoolsHook

export const devtoolsComponentAdded = createDevtoolsComponentHook(
    DevtoolsHooks.COMPONENT_ADDED
)

function createDevtoolsComponentHook(hook: DevtoolsHooks) {
    return (component: ComponentInternalInstance) => {
        if (!devtools) return;
        devtools.emit(
            hook,
            component.appContext.app,
            component.uid,
            component.parent ? component.parent.uid : undefined
        )
    }
}

export function devtoolsComponentEmit(
    component: ComponentInternalInstance,
    event: string,
    params: any[]
) {
    if (!devtools) return
    devtools.emit(
        DevtoolsHooks.COMPONENT_EMIT,
        component.appContext.app,
        component,
        event,
        params
    )
}
