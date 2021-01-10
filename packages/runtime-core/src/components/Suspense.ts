import {SuspenseBoundary} from "../suspense";
import {isArray} from "@vue/shared";
import {queuePostFlushCb} from "../scheduler";

export function queueEffectWithSuspense(
    fn: Function | Function[],
    suspense: SuspenseBoundary | null
): void {
    if (suspense && suspense.pendingBranch) {
        if (isArray(fn)) {
            suspense.effects.push(...fn)
        } else {
            suspense.effects.push(fn)
        }
    } else {
        queuePostFlushCb(fn)
    }
}
