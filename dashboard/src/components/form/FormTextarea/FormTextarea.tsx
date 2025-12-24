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
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import { cn, isNotEmptyValue } from '@/lib/utils';
import { forwardRef, type ForwardedRef, type ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
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
  transform?: Transformer;
  className?: string;
  inline?: boolean;
  helperText?: string | null;
  infoTooltip?: string | null;
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
    infoTooltip,
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
            className={cn({ 'flex w-full items-center gap-4 py-3': inline })}
          >
            {infoTooltip ? (
              <div className="flex flex-row items-center gap-2">
                <FormLabel
                  className={cn({
                    'mt-2 w-52 max-w-52 flex-shrink-0 self-start': inline,
                  })}
                >
                  {label}
                </FormLabel>
                <InfoTooltip>{infoTooltip}</InfoTooltip>
              </div>
            ) : (
              <FormLabel
                className={cn({
                  'mt-2 w-52 max-w-52 flex-shrink-0 self-start': inline,
                })}
              >
                {label}
              </FormLabel>
            )}
            <div
              className={cn({
                'flex w-[calc(100%-13.5rem)] max-w-[calc(100%-13.5rem)] flex-col gap-2':
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
