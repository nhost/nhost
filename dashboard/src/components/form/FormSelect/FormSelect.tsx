import {
  type ForwardedRef,
  forwardRef,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
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
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { cn, isNotEmptyValue } from '@/lib/utils';

const selectClasses =
  'aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500';

interface FormSelectProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label?: ReactNode;
  placeholder?: string;
  className?: string;
  containerClassName?: string;
  // Forwarded to the dropdown content. Needed to raise the z-index when the
  // select lives inside a higher-stacked container such as a MUI dialog.
  contentClassName?: string;
  inline?: boolean;
  helperText?: string | null;
  helperTextClassName?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  transform?: Transformer;
  'data-testid'?: string;
}

function FormSelectImpl<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  {
    control,
    name,
    label,
    placeholder,
    className,
    containerClassName,
    contentClassName,
    inline,
    helperText,
    helperTextClassName,
    disabled,
    autoFocus,
    children,
    transform,
    'data-testid': dataTestId,
  }: PropsWithChildren<FormSelectProps<TFieldValues, TName>>,
  ref?: ForwardedRef<HTMLButtonElement>,
) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const {
          ref: fieldRef,
          onChange,
          ...fieldProps
        } = isNotEmptyValue(transform)
          ? getTransformedFieldProps(field, transform)
          : field;
        return (
          <FormItem
            className={cn(
              {
                'sm:flex sm:w-full sm:items-center sm:gap-4 sm:py-3': inline,
              },
              containerClassName,
            )}
          >
            <FormLabel
              className={cn({
                'sm:w-52 sm:max-w-52 sm:flex-shrink-0': inline,
                'sm:mt-2 sm:self-start': inline && !!helperText,
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
              <Select
                disabled={disabled}
                onValueChange={onChange}
                {...fieldProps}
              >
                <FormControl>
                  <SelectTrigger
                    className={cn(selectClasses, className)}
                    ref={mergeRefs([fieldRef, ref])}
                    data-testid={dataTestId}
                    autoFocus={autoFocus}
                  >
                    <SelectValue placeholder={placeholder} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className={contentClassName}>
                  {children}
                </SelectContent>
              </Select>
              {!!helperText && (
                <FormDescription
                  className={cn('break-all px-[1px]', helperTextClassName)}
                >
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
const FormSelect = forwardRef(FormSelectImpl) as <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  props: PropsWithChildren<FormSelectProps<TFieldValues, TName>> & {
    ref?: ForwardedRef<HTMLButtonElement>;
  },
) => ReturnType<typeof FormSelectImpl>;
export default FormSelect;
