import {
  type ChangeEventHandler,
  type FocusEventHandler,
  type ForwardedRef,
  forwardRef,
  type ReactNode,
} from 'react';
import type {
  Control,
  FieldPath,
  FieldValues,
  PathValue,
} from 'react-hook-form';
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
import {
  PasswordInput,
  type PasswordInputProps,
} from '@/components/ui/v3/password-input';
import { cn, isNotEmptyValue } from '@/lib/utils';

const inputClasses =
  '!bg-transparent aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500 disabled:!bg-data-cell-bg-disabled disabled:text-disabled disabled:placeholder:text-disabled disabled:opacity-100';

interface FormPasswordInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label?: ReactNode;
  placeholder?: string;
  'aria-label'?: string;
  className?: string;
  containerClassName?: string;
  inline?: boolean;
  helperText?: string | null;
  transform?: Transformer;
  transformValue?: (
    value: PathValue<TFieldValues, TName>,
  ) => PathValue<TFieldValues, TName>;
  disabled?: boolean;
  autoComplete?: PasswordInputProps['autoComplete'];
  'data-testid'?: string;
  /**
   * Called after the field's onChange runs. Use for side effects like syncing
   * dependent fields.
   */
  onChange?: ChangeEventHandler<HTMLInputElement>;
  /**
   * Called after the field's onBlur runs.
   */
  onBlur?: FocusEventHandler<HTMLInputElement>;
}

function InnerFormPasswordInput<
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
    inline,
    helperText,
    disabled,
    autoComplete,
    transform,
    'data-testid': dataTestId,
    'aria-label': ariaLabel,
    onChange: onChangeProp,
    onBlur: onBlurProp,
  }: FormPasswordInputProps<TFieldValues, TName>,
  ref?: ForwardedRef<HTMLInputElement>,
) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const baseFieldProps = isNotEmptyValue(transform)
          ? getTransformedFieldProps(field, transform)
          : field;
        const {
          onChange: fieldOnChange,
          onBlur: fieldOnBlur,
          ...restFieldProps
        } = baseFieldProps;
        const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
          fieldOnChange(event);
          onChangeProp?.(event);
        };
        const handleBlur: FocusEventHandler<HTMLInputElement> = (event) => {
          fieldOnBlur();
          onBlurProp?.(event);
        };
        return (
          <FormItem
            className={cn(
              {
                'sm:flex sm:w-full sm:items-center sm:gap-4 sm:py-3': inline,
              },
              containerClassName,
            )}
          >
            {!!label && (
              <FormLabel
                className={cn({
                  'sm:mt-2 sm:w-52 sm:max-w-52 sm:flex-shrink-0 sm:self-start':
                    inline,
                })}
              >
                {label}
              </FormLabel>
            )}
            <div
              className={cn({
                'space-y-2': !!helperText,
                'sm:flex sm:w-[calc(100%-13.5rem)] sm:max-w-[calc(100%-13.5rem)] sm:flex-col sm:gap-2':
                  inline,
              })}
            >
              <FormControl>
                <PasswordInput
                  placeholder={placeholder}
                  disabled={disabled}
                  autoComplete={autoComplete}
                  data-testid={dataTestId}
                  aria-label={ariaLabel}
                  aria-invalid={fieldState.invalid}
                  {...restFieldProps}
                  onChange={handleChange}
                  onBlur={handleBlur}
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

const FormPasswordInput = forwardRef(InnerFormPasswordInput) as <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  props: FormPasswordInputProps<TFieldValues, TName> & {
    ref?: ForwardedRef<HTMLInputElement>;
  },
) => ReturnType<typeof InnerFormPasswordInput>;

export default FormPasswordInput;
