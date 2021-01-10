import { ComponentOptionsBase, ComponentOptionsMixin, ComputedOptions, MethodOptions } from './componentOptions'
import { EmitsOptions } from './componentEmits'
import { ComponentPublicInstance, CreateComponentPublicInstance } from './componentPublicInstance'

export type DefineComponent<PropsOrPropsOptions = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions,
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = Record<string, any>,
  EE extends string = string,
  PP = PublicProps,
  Props = Readonly<ExtractPropTypes<PropsOrPropsOptions>>,
  Defaults = ExtractDefaultPropTypes<PropsOrPropsOptions>> =
  ComponentPublicInstance<CreateComponentPublicInstance<Props,
    RawBindings,
    D,
    C,
    M,
    Mixin,
    Extends,
    E,
    PP & Props,
    Defaults,
    true> & Props>
  & ComponentOptionsBase<Props, RawBindings, D, C, M, Mixin, Extends, E, EE, Defaults>
  & PP
