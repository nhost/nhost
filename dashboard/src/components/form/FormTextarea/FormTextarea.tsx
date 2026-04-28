import { type ForwardedRef, forwardRef, type ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { mergeRefs } from 'react-merge-refs';
import getTransformedFieldProps, {
  type Transformer,
} from '@/components/form/utils/getTransformedFieldProps';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Textarea } from '@/components/ui/v3/textarea';
import { cn, isNotEmptyValue } from '@/lib/utils';

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
  transform?: Transformer;
  className?: string;
  inline?: boolean;
  helperText?: string | null;
}

function FormTextareaImpl<
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
    transform,
  }: FormTextareaProps<TFieldValues, TName>,
  ref?: ForwardedRef<HTMLTextAreaElement>,
) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const fieldProps = isNotEmptyValue(transform)
          ? getTransformedFieldProps(field, transform)
          : field;
        return (
          <FormItem
            className={cn({
              'sm:flex sm:w-full sm:items-center sm:gap-4 sm:py-3': inline,
            })}
          >
            <FormLabel
              className={cn({
                'sm:mt-2 sm:w-52 sm:max-w-52 sm:flex-shrink-0 sm:self-start':
                  inline,
              })}
            >
              {label}
            </FormLabel>
            <div
              className={cn({
                'sm:flex sm:w-[calc(100%-13.5rem)] sm:max-w-[calc(100%-13.5rem)] sm:flex-col sm:gap-2':
                  inline,
              })}
            >
              <FormControl>
                <Textarea
                  placeholder={placeholder}
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

const FormTextarea = forwardRef(FormTextareaImpl) as <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  props: FormTextareaProps<TFieldValues, TName> & {
    ref?: ForwardedRef<HTMLTextAreaElement>;
  },
) => ReturnType<typeof FormTextareaImpl>;

export default FormTextarea;
