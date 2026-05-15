import { type ForwardedRef, forwardRef, type ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { mergeRefs } from 'react-merge-refs';
import { Checkbox } from '@/components/ui/v3/checkbox';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { cn } from '@/lib/utils';

interface FormCheckboxProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label?: ReactNode;
  className?: string;
  containerClassName?: string;
  helperText?: string | null;
  disabled?: boolean;
  /**
   * When true and the checkbox is disabled, the rendered checked state is
   * forced to false regardless of the form value. The form value itself is
   * left untouched.
   */
  uncheckWhenDisabled?: boolean;
  'aria-label'?: string;
  'data-testid'?: string;
}

function InnerFormCheckbox<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  {
    control,
    name,
    label,
    className,
    containerClassName,
    helperText,
    disabled,
    uncheckWhenDisabled,
    'aria-label': ariaLabel,
    'data-testid': dataTestId,
  }: FormCheckboxProps<TFieldValues, TName>,
  ref?: ForwardedRef<HTMLButtonElement>,
) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const checked =
          uncheckWhenDisabled && disabled ? false : Boolean(field.value);

        return (
          <FormItem className={cn('flex flex-col gap-2', containerClassName)}>
            <div className="flex items-center gap-2">
              <FormControl>
                <Checkbox
                  checked={checked}
                  onCheckedChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={disabled}
                  ref={mergeRefs([field.ref, ref])}
                  className={className}
                  aria-label={ariaLabel}
                  data-testid={dataTestId}
                />
              </FormControl>
              {!!label && (
                <FormLabel className="font-normal">{label}</FormLabel>
              )}
            </div>
            {!!helperText && (
              <FormDescription className="break-all px-[1px]">
                {helperText}
              </FormDescription>
            )}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

const FormCheckbox = forwardRef(InnerFormCheckbox) as <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  props: FormCheckboxProps<TFieldValues, TName> & {
    ref?: ForwardedRef<HTMLButtonElement>;
  },
) => ReturnType<typeof InnerFormCheckbox>;

export default FormCheckbox;
