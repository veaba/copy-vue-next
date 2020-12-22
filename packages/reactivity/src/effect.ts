import { TrackOpTypes, TriggerOpTypes } from "./operations";

type Dep = Set<ReactiveEffect>;

export type DebuggerEvent = {
  effect: ReactiveEffect;
  target: object;
  type: TrackOpTypes | TriggerOpTypes;
  key: any;
} & DebuggerEventExtraInfo;

export interface ReactiveEffect<T = any> {
  (): T;
  _isEffect: true;
  id: number;
  active: boolean;
  raw: () => T;
  deps: Array<Dep>;
  options: ReactiveEffectOptions;
  allowRecurse: boolean;
}

export interface ReactiveEffectOptions {
  lazy?: boolean;
  scheduler?: (job: ReactiveEffect) => void;
  onTrack?: (event: DebuggerEvent) => void;
  onTrigger?: (event: DebuggerEvent) => void;
  onStop?: () => void;
  allowRecurse?: boolean;
}

export interface DebuggerEventExtraInfo {
  newValue?: any;
  oldValue?: any;
  oldTarge?: Map<any, any> | Set<any>;
}
