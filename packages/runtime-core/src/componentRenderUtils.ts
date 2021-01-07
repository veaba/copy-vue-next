// 在渲染过程中标记当前渲染实例进行资产解析(如resolveComponent, resolveDirective）
import {ComponentInternalInstance} from "./component";

export let currentRenderingInstance: ComponentInternalInstance | null = null
