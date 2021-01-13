import { ConcreteComponent } from './component'

export interface HMRRuntime {
  createRecord: typeof createRecord,
  rerender: typeof rerender,
  reload: typeof reload
}

export const hmrDirtyComponents = new Set<ConcreteComponent>()
