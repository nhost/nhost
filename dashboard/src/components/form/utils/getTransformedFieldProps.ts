import type {
  ControllerRenderProps,
  FieldPath,
  FieldValues,
  PathValue,
} from 'react-hook-form';

type InTransformerFn<
  T extends FieldValues = FieldValues,
  N extends FieldPath<T> = FieldPath<T>,
> = (value: PathValue<T, N>) => PathValue<T, N>;

// biome-ignore lint/suspicious/noExplicitAny: TODO
export type OutTransformerFn = (...args: any[]) => any;

export type Transformer = {
  in: InTransformerFn;
  out: OutTransformerFn;
};

const DEFAULT_TRANSFORMER: Transformer = {
  in: (v) => v,
  out: (v) => v,
};

function getTransformedFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(field: ControllerRenderProps<TFieldValues, TName>, transformer: Transformer) {
  const { value, onChange, ...fieldProps } = field;

  const tf = {
    ...DEFAULT_TRANSFORMER,
    ...transformer,
  };

  return {
    ...fieldProps,
    value: tf.in(value),
    // biome-ignore lint/suspicious/noExplicitAny: TODO
    onChange(...args: any[]) {
      const transformedEvent = tf.out(...args);
      onChange(transformedEvent);
    },
  };
}

export default getTransformedFieldProps;
