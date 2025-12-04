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
import { Input, type InputProps } from '@/components/ui/v3/input';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import { cn, isNotEmptyValue } from '@/lib/utils';
import { type ForwardedRef, forwardRef, type ReactNode } from 'react';
import type {
  Control,
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
  containerClassName?: string;
  type?: string;
  inline?: boolean;
  helperText?: string | null;
  transform?: Transformer;
  transformValue?: (
    value: PathValue<TFieldValues, TName>,
  ) => PathValue<TFieldValues, TName>;
  disabled?: boolean;
  autoComplete?: InputProps['autoComplete'];
  infoTooltip?: string;
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
    containerClassName = '',
    type = 'text',
    inline,
    helperText,
    disabled,
    autoComplete,
    infoTooltip,
    transform,
  }: FormInputProps<TFieldValues, TName>,
  ref?: ForwardedRef<HTMLInputElement>,
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
            className={cn(
              { 'flex w-full items-center gap-4 py-3': inline },
              containerClassName,
            )}
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
                <Input
                  type={type}
                  placeholder={placeholder}
                  disabled={disabled}
                  autoComplete={autoComplete}
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
