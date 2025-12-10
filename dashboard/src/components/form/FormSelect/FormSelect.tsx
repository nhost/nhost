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
import {
  type ForwardedRef,
  type PropsWithChildren,
  type ReactNode,
  forwardRef,
} from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { mergeRefs } from 'react-merge-refs';

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
  transform?: Transformer;
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
    inline,
    helperText,
    disabled,
    children,
    transform,
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
                disabled={disabled}
                onValueChange={onChange}
                {...fieldProps}
              >
                <FormControl>
                  <SelectTrigger
                    className={cn(selectClasses, className)}
                    ref={mergeRefs([fieldRef, ref])}
                  >
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
const FormSelect = forwardRef(FormSelectImpl) as <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  props: PropsWithChildren<FormSelectProps<TFieldValues, TName>> & {
    ref?: ForwardedRef<HTMLButtonElement>;
  },
) => ReturnType<typeof FormSelectImpl>;
export default FormSelect;
