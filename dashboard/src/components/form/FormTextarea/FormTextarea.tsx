import { getOnChangeHandlerAndValue } from '@/components/form/utils/getOnChangeHandler';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Textarea } from '@/components/ui/v3/textarea';
import { cn } from '@/lib/utils';
import { forwardRef, type ForwardedRef, type ReactNode } from 'react';
import type {
  Control,
  FieldPath,
  FieldValues,
  PathValue,
} from 'react-hook-form';
import { mergeRefs } from 'react-merge-refs';

const inputClasses =
  '!bg-transparent aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500';

interface FormTextareaProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label: ReactNode;
  placeholder?: string;
  className?: string;
  inline?: boolean;
  helperText?: string | null;
  transformValue?: (
    value: PathValue<TFieldValues, TName>,
  ) => PathValue<TFieldValues, TName>;
}

function InnerFormTextarea<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  {
    control,
    name,
    label,
    placeholder,
    className = '',
    inline,
    helperText,
    transformValue,
  }: FormTextareaProps<TFieldValues, TName>,
  ref: ForwardedRef<HTMLTextAreaElement>,
) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const { onChange, value, ...fieldProps } = field;

        const [tValue, handleOnChange] = getOnChangeHandlerAndValue<
          TFieldValues,
          TName
        >(field, transformValue);
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
                <Textarea
                  placeholder={placeholder}
                  onChange={handleOnChange}
                  value={tValue}
                  {...fieldProps}
                  ref={mergeRefs([field.ref, ref])}
                  className={cn(inputClasses, className)}
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

const FormTextarea = forwardRef(InnerFormTextarea) as <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  props: FormTextareaProps<TFieldValues, TName> & {
    ref: ForwardedRef<HTMLTextAreaElement>;
  },
) => ReturnType<typeof InnerFormTextarea>;

export default FormTextarea;
