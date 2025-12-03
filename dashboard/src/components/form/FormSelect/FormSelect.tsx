import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { cn, isNotEmptyValue } from '@/lib/utils';
import type { PropsWithChildren, ReactNode } from 'react';
import type {
  Control,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
  PathValue,
} from 'react-hook-form';

const selectClasses =
  'aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500';

interface FormSelectProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label: ReactNode;
  placeholder?: string;
  className?: string;
  containerClassName?: string;
  inline?: boolean;
  helperText?: string | null;
  disabled?: boolean;
  transformValue?: (
    value: PathValue<TFieldValues, TName>,
  ) => PathValue<TFieldValues, TName>;
}

function FormSelect<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  placeholder,
  className = '',
  containerClassName = '',
  inline,
  helperText,
  disabled,
  children,
  transformValue,
}: PropsWithChildren<FormSelectProps<TFieldValues, TName>>) {
  function getOnChangeHandlerAndValue(
    field: ControllerRenderProps<TFieldValues, TName>,
  ): [string, (v: string) => void] {
    const { onChange, value } = field;

    function handleOnChange(newValue: string) {
      const transformedNewValue = isNotEmptyValue(transformValue)
        ? transformValue(newValue as PathValue<TFieldValues, TName>)
        : newValue;

      onChange(transformedNewValue);
    }

    const transformedValue: string = isNotEmptyValue(transformValue)
      ? transformValue(value as PathValue<TFieldValues, TName>)
      : value;

    return [transformedValue, handleOnChange];
  }
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const { onChange, value, ...selectProps } = field;
        const [tValue, handleOnChange] = getOnChangeHandlerAndValue(field);
        return (
          <FormItem
            className={cn(
              { 'flex w-full items-center gap-4 py-3': inline },
              containerClassName,
            )}
          >
            <FormLabel
              className={cn({
                'w-52 max-w-52 flex-shrink-0': inline,
                'mt-2 self-start': inline && !!helperText,
              })}
            >
              {label}
            </FormLabel>
            <div
              className={cn({
                'flex w-[calc(100%-13.5rem)] max-w-[calc(100%-13.5rem)] flex-col gap-2':
                  inline,
              })}
            >
              <Select
                onValueChange={handleOnChange}
                value={tValue}
                disabled={disabled}
                {...selectProps}
              >
                <FormControl>
                  <SelectTrigger className={cn(selectClasses, className)}>
                    <SelectValue placeholder={placeholder} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>{children}</SelectContent>
              </Select>
              {!!helperText && (
                <FormDescription className="break-all px-[1px]">
                  {helperText}
                </FormDescription>
              )}
              <FormMessage />
            </div>
          </FormItem>
        );
      }}
    />
  );
}

export default FormSelect;
