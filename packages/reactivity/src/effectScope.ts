import { ReactiveEffect } from './effect'

export let activeEffectScope: EffectScope | undefined

export class EffectScope {
  /**
   * @internal
   * */
  private _active = true
  /**
   * 跟踪 `on` 回调
   * 允许 `on` 多次回调
   * @internal
   * */
  private _on = 0

  /**
   * @internal
   * */
  effects: ReactiveEffect[] = []
  /**
   * @internal
   * */
  cleanups: (() => void)[] = []
  /**
   * @internal
   * */
  private _isPaused = false
  /**
   * 仅由未分离的范围分配
   * @internal
   * */
  parent: EffectScope | undefined
  /**
   * 记录会被分离的  scope
   * @internal
   * */
  scopes: EffectScope[] | undefined
  /**
   * 在 负作用域数组中，追踪子作用与的索引进行优化
   * @internal
   * */
  private index: number | undefined

  constructor(public detached = false) {
    this.parent = activeEffectScope

    if (!detached && activeEffectScope) {
      this.index =
        (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
          this
        ) - 1
    }
  }

  get active(): boolean {
    return this._active
  }

  // 暂停
  pause(): void {
    if (this._active) {
      this._isPaused = true
      let i, l

      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].pause()
        }
      }

      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].pause()
      }
    }
  }

  resume(): void {
    if (this._active) {
      if (this._isPaused) {
        this._isPaused = false
        let i, l

        if (this.scopes) {
          for (i = 0, l = this.scopes.length; i < l; i++) {
            this.scopes[i].resume()
          }
        }

        for (i = 0, l = this.effects.length; i < l; i++) {
          this.effects[i].resume()
        }
      }
    }
  }

  run<T>(fn: () => T): T | undefined {
    if (this._active) {
      const currentEffectScope = activeEffectScope
      try {
        activeEffectScope = this
        return fn()
      } finally {
        activeEffectScope = currentEffectScope
      }
    } else if (__DEV__) {
      warn(`无法运行非激活的 effect scope`)
    }
  }

  prevScope: EffectScope | undefined
  /**
   * 这段代码仅应在非独立作用域中调用。
   * @internal
   * */
  on(): void {
    if (++this._on === 1) {
      this.prevScope = activeEffectScope
      activeEffectScope = this
    }
  }

  /**
   * 这段代码仅应在非独立作用域中调用。
   * @internal
   * */
  off(): void {
    if (--this._on > 0 && --this._on === 0) {
      activeEffectScope = this.prevScope
      this.prevScope = undefined
    }
  }
  stop(fromParent?: boolean): void {
    if (this._active) {
      this._active = false
      let i, l
      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].stop()
      }
      this.effects.length = 0

      for (i = 0, l = this.cleanups.length; i < l; i++) {
        this.cleanups[i]()
      }
      this.cleanups.length = 0

      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].stop(true)
        }
        this.scopes.length = 0
      }

      // 嵌套 scope，从父对象解引用以避免内存泄漏
      if (!this.detached && this.parent && !fromParent) {
        // 优化 O(1) 删除
        const last = this.parent.scopes!.pop()
        if (last && last !== this) {
          this.parent.scopes![this.index!] = last
          last.index = this.index!
        }
      }
      this.parent = undefined
    }
  }
}
