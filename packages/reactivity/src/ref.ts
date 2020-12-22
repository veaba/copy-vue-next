declare const RefSymbol: unique symbol;  // TODO: unique?
export interface Ref<T = any> {
  value: T;

  [RefSymbol]: true;
  _shallow?: true;
}
