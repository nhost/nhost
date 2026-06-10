import type { ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { Combobox, type ComboboxOption } from '@/components/ui/v3/combobox';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { cn } from '@/lib/utils';

export type { ComboboxOption as FormComboboxOption };

const comboboxTriggerClasses =
  'aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500';

interface FormComboboxProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label?: ReactNode;
  placeholder?: string;
  className?: string;
  containerClassName?: string;
  inline?: boolean;
  helperText?: ReactNode | null;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyText?: ReactNode;
  options: ComboboxOption[];
  filter?: (value: string, search: string, keywords?: string[]) => number;
  /**
   * Fired after the field is updated with the newly selected value.
   */
  onChange?: (value: string) => void;
  'data-testid'?: string;
}

export default function FormCombobox<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  placeholder,
  className,
  containerClassName,
  inline,
  helperText,
  disabled,
  searchPlaceholder,
  emptyText,
  options,
  filter,
  onChange: onChangeProp,
  'data-testid': dataTestId,
}: FormComboboxProps<TFieldValues, TName>) {
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
          {!!label && (
            <FormLabel
              className={cn({
                'w-52 max-w-52 flex-shrink-0': inline,
                'mt-2 self-start': inline && !!helperText,
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
              <Combobox
                ref={field.ref}
                value={field.value ?? null}
                onChange={(next) => {
                  field.onChange(next);
                  onChangeProp?.(next);
                }}
                onBlur={field.onBlur}
                options={options}
                filter={filter}
                placeholder={placeholder}
                searchPlaceholder={searchPlaceholder}
                emptyText={emptyText}
                disabled={disabled}
                className={cn(comboboxTriggerClasses, className)}
                data-testid={dataTestId}
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
      )}
    />
  );
}
