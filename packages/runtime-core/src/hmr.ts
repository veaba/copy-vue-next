export interface HMRRuntime {
  createRecord: typeof createRecord,
  rerender: typeof rerender,
  reload: typeof reload
}
