import {DebuggerEvent} from "@vue/reactivity";
import {ComponentInternalInstance} from "./component";

export type DebuggerHook = (e: DebuggerEvent) => void

export type ErrorCapturedHook = (
    err: unknown,
    instance: ComponentInternalInstance | null,
    info: string
) => boolean | void
