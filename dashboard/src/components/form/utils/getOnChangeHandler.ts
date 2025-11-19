import { isNotEmptyValue } from '@/lib/utils';
import type {
  ControllerRenderProps,
  FieldPath,
  FieldValues,
  PathValue,
} from 'react-hook-form';

export function getOnChangeHandlerAndValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  field: ControllerRenderProps<TFieldValues, TName>,
  transformValue?: (
    value: PathValue<TFieldValues, TName>,
  ) => PathValue<TFieldValues, TName>,
): [
  PathValue<TFieldValues, TName>,
  ControllerRenderProps<TFieldValues, TName>['onChange'],
] {
  const { onChange, value } = field;

  function handleOnChange(newValue: string) {
    const transformedNewValue = isNotEmptyValue(transformValue)
      ? transformValue(newValue as PathValue<TFieldValues, TName>)
      : newValue;

    onChange(transformedNewValue);
  }

  const transformedValue: PathValue<TFieldValues, TName> = isNotEmptyValue(
    transformValue,
  )
    ? transformValue(value as PathValue<TFieldValues, TName>)
    : value;

  return [transformedValue, handleOnChange];
}
