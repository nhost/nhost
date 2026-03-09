import { type ForwardedRef, forwardRef, type ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { mergeRefs } from 'react-merge-refs';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/v3/form';
import { Switch } from '@/components/ui/v3/switch';
import { cn } from '@/lib/utils';

interface FormSwitchProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label: ReactNode;
  className?: string;
  containerClassName?: string;
  inline?: boolean;
  helperText?: string | null;
  disabled?: boolean;
}

function InnerFormSwitch<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  {
    control,
    name,
    label,
    className = '',
    containerClassName = '',
    inline,
    helperText,
    disabled,
  }: FormSwitchProps<TFieldValues, TName>,
  ref?: ForwardedRef<HTMLButtonElement>,
) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem
          className={cn(
            { 'flex w-full items-center gap-4 py-3': inline },
            containerClassName,
          )}
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
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
                ref={mergeRefs([field.ref, ref])}
                className={className}
              />
            </FormControl>
            {!!helperText && (
              <FormDescription className="break-all px-[1px]">
                {helperText}
              </FormDescription>
            )}
          </div>
        </FormItem>
      )}
    />
  );
}

const FormSwitch = forwardRef(InnerFormSwitch) as <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  props: FormSwitchProps<TFieldValues, TName> & {
    ref?: ForwardedRef<HTMLButtonElement>;
  },
) => ReturnType<typeof InnerFormSwitch>;

export default FormSwitch;
