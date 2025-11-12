import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
import { cn, isNotEmptyValue } from '@/lib/utils';
import {
  type ChangeEvent,
  type ForwardedRef,
  forwardRef,
  type ReactNode,
} from 'react';
import type {
  Control,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
  PathValue,
} from 'react-hook-form';
import { mergeRefs } from 'react-merge-refs';

const inputClasses =
  '!bg-transparent aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500';

interface FormInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label: ReactNode;
  placeholder?: string;
  className?: string;
  type?: string;
  inline?: boolean;
  helperText?: string | null;
  transformValue?: (
    value: PathValue<TFieldValues, TName>,
  ) => PathValue<TFieldValues, TName>;
}

function InnerFormInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  {
    control,
    name,
    label,
    placeholder,
    className = '',
    type = 'text',
    inline,
    helperText,
    transformValue,
  }: FormInputProps<TFieldValues, TName>,
  ref: ForwardedRef<HTMLInputElement>,
) {
  function getOnChangeHandlerAndValue(
    field: ControllerRenderProps<TFieldValues, TName>,
  ): [
    PathValue<TFieldValues, TName>,
    (e: ChangeEvent<HTMLInputElement>) => void,
  ] {
    const { onChange, value } = field;

    function handleOnChange(event: ChangeEvent<HTMLInputElement>) {
      let transformedValue = event.target.value;
      if (isNotEmptyValue(transformValue)) {
        transformedValue = transformValue(
          event.target.value as PathValue<TFieldValues, TName>,
        );
      }
      onChange(transformedValue);
    }

    const transformedValue = isNotEmptyValue(transformValue)
      ? transformValue(value)
      : value;

    return [transformedValue, handleOnChange];
  }
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const { onChange, value, ...fieldProps } = field;

        const [tValue, handleOnChange] = getOnChangeHandlerAndValue(field);
        return (
          <FormItem
            className={cn({ 'flex w-full items-center gap-4 py-3': inline })}
          >
            <FormLabel
              className={cn({
                'mt-2 w-52 max-w-52 flex-shrink-0 self-start': inline,
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
              <FormControl>
                <Input
                  type={type}
                  placeholder={placeholder}
                  onChange={handleOnChange}
                  value={tValue}
                  {...fieldProps}
                  ref={mergeRefs([field.ref, ref])}
                  className={cn(inputClasses, className)}
                  wrapperClassName={cn({ 'w-full': !inline })}
                />
              </FormControl>
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

const FormInput = forwardRef(InnerFormInput) as <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  props: FormInputProps<TFieldValues, TName> & {
    ref?: ForwardedRef<HTMLInputElement>;
  },
) => ReturnType<typeof InnerFormInput>;

export default FormInput;
