export enum ReactiveFlags {
  SKIP = '__v_skip',
  // 判断是响应式
  IS_REACTIVE = '__v_isReactive',
  // 只读，一些对象不希望被改
  IS_READONLY = '__v_isReadonly',
  // 区别深层嵌套
  IS_SHALLOW = '__v_isShallow',
  RAW = '__v_raw',
  IS_REF = '__v_isRef'
}

export enum TargetType {
  INVALID = 0,
  COMMON = 1,
  COLLECTION = 2
}

export enum EffectFlags {
  /**
   * ReactiveEffect only
   */
  ACTIVE = 1 << 0,
  RUNNING = 1 << 1,
  TRACKING = 1 << 2,
  NOTIFIED = 1 << 3,
  DIRTY = 1 << 4,
  ALLOW_RECURSE = 1 << 5,
  PAUSED = 1 << 6,
  // 评估
  EVALUATED = 1 << 7
}

export enum WatchErrorCodes {
  WATCH_GETTER = 2,
  WATCH_CALLBACK,
  WATCH_CLEANUP
}
