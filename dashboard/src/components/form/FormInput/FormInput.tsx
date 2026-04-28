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
import { Input, type InputProps } from '@/components/ui/v3/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/v3/input-group';
import { cn, isNotEmptyValue } from '@/lib/utils';

const inputClasses =
  '!bg-transparent aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500';

interface FormInputProps<
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
  type?: string;
  inline?: boolean;
  helperText?: string | null;
  transform?: Transformer;
  transformValue?: (
    value: PathValue<TFieldValues, TName>,
  ) => PathValue<TFieldValues, TName>;
  disabled?: boolean;
  autoComplete?: InputProps['autoComplete'];
  /**
   * Content rendered as an addon before the input (left side). When set,
   * the input is rendered inside an `InputGroup`.
   */
  addonStart?: ReactNode;
  /**
   * Content rendered as an addon after the input (right side). When set,
   * the input is rendered inside an `InputGroup`.
   */
  addonEnd?: ReactNode;
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
    transform,
    addonStart,
    addonEnd,
    'data-testid': dataTestId,
    'aria-label': ariaLabel,
    onChange: onChangeProp,
    onBlur: onBlurProp,
  }: FormInputProps<TFieldValues, TName>,
  ref?: ForwardedRef<HTMLInputElement>,
) {
  const hasAddon = !!addonStart || !!addonEnd;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
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
                'sm:flex sm:w-[calc(100%-13.5rem)] sm:max-w-[calc(100%-13.5rem)] sm:flex-col sm:gap-2':
                  inline,
              })}
            >
              <FormControl>
                {hasAddon ? (
                  <InputGroup className="h-10 bg-transparent dark:bg-transparent">
                    {!!addonStart && (
                      <InputGroupAddon align="inline-start">
                        {addonStart}
                      </InputGroupAddon>
                    )}
                    <InputGroupInput
                      type={type}
                      placeholder={placeholder}
                      disabled={disabled}
                      autoComplete={autoComplete}
                      data-testid={dataTestId}
                      aria-label={ariaLabel}
                      {...restFieldProps}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      ref={mergeRefs([field.ref, ref])}
                      className={cn(inputClasses, className)}
                    />
                    {!!addonEnd && (
                      <InputGroupAddon align="inline-end">
                        {addonEnd}
                      </InputGroupAddon>
                    )}
                  </InputGroup>
                ) : (
                  <Input
                    type={type}
                    placeholder={placeholder}
                    disabled={disabled}
                    autoComplete={autoComplete}
                    data-testid={dataTestId}
                    aria-label={ariaLabel}
                    {...restFieldProps}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    ref={mergeRefs([field.ref, ref])}
                    className={cn(inputClasses, className)}
                    wrapperClassName={cn({ 'w-full': !inline })}
                  />
                )}
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
