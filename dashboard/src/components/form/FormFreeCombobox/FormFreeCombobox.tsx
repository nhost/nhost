import type { ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import {
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import {
  type ComboboxOption,
  FreeCombobox,
  type FreeComboboxChangeMeta,
} from '@/components/ui/v3/free-combobox';
import { cn } from '@/lib/utils';

export type { ComboboxOption as FormFreeComboboxOption };

interface FormFreeComboboxProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label?: ReactNode;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: ReactNode;
  className?: string;
  containerClassName?: string;
  inline?: boolean;
  helperText?: ReactNode | null;
  disabled?: boolean;
  options: ComboboxOption[];
  filter?: (value: string, search: string, keywords?: string[]) => number;
  customValueLabel?: (input: string) => ReactNode;
  /**
   * Fired after the field is updated. `meta.source` tells whether the value
   * was picked from the option list or typed as a custom value.
   */
  onChange?: (value: string, meta: FreeComboboxChangeMeta) => void;
  popoverContentClassName?: string;
  'data-testid'?: string;
  'aria-label'?: string;
}

export default function FormFreeCombobox<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  containerClassName,
  inline,
  helperText,
  onChange: onChangeProp,
  ...comboboxProps
}: FormFreeComboboxProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
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
            <FreeCombobox
              {...comboboxProps}
              ref={field.ref}
              value={field.value ?? null}
              onChange={(next, meta) => {
                field.onChange(next);
                onChangeProp?.(next, meta);
              }}
              onBlur={field.onBlur}
              aria-invalid={!!fieldState.error}
            />
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
