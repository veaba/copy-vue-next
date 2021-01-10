import {RendererElement} from "./renderer";
import {VNode} from "./vnode";


export interface BaseTransitionProps<HostElement = RendererElement> {
    mode?: 'in-out' | 'out-in' | 'default'
    appear?: boolean

    // 如果为 true，表示这是一个过渡，实际上并没有 insert/remove 元素，而是切换了 show/hidden 状态。
    // 注入了过渡钩子，但会被渲染器跳过。
    // 相反，自定义指令可以通过调用注入的钩子（如v-show）来 transition。
    persisted?: boolean

    // 钩子。 在渲染函数和JSX中使用驼峰大小写以方便使用。
    // 在模板中，这些可以写成 @before-enter="xxx"，因为 prop 名称是 驼峰的。
    onBeforeEnter?: (el: HostElement) => void
    onEnter?: (el: HostElement, done: () => void) => void
    onAfterEnter?: (el: HostElement) => void
    onEnterCancelled?: (el: HostElement) => void

    // leave
    onBeforeLeave?: (el: HostElement) => void
    onLeave?: (el: HostElement) => void
    onAfterLeave?: (el: HostElement) => void
    onLeaveCancelled?: (el: HostElement) => void

    // appear
    onBeforeAppear?: (el: HostElement) => void
    onAppear?: (el: HostElement) => void
    onAfterAppear?: (el: HostElement) => void
    onAppearCancelled?: (el: HostElement) => void


}

export interface TransitionHooks<HostElement extends RendererElement = RendererElement> {
    mode: BaseTransitionProps['mode']
    persisted: boolean

    beforeEnter(el: HostElement): void

    enter(el: HostElement): void

    leave(el: HostElement): void

    clone(vnode: VNode): TransitionHooks<HostElement>

    // 可选
    afterLeave?(): void

    delayLeave?(
        el: HostElement,
        earlyRemove: () => void,
        delayedLeave: () => void
    ): void

    delayedLeave?(): void

}
