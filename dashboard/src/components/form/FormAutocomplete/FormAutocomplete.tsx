import type { ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import {
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { cn } from '@/lib/utils';
import FormAutocompleteCore, {
  type FormAutocompleteOption,
} from './FormAutocompleteCore';

export type { FormAutocompleteOption };

interface FormAutocompleteProps<
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
  options: FormAutocompleteOption[];
  filter?: (value: string, search: string, keywords?: string[]) => number;
  allowCustomValue?: boolean;
  customValueLabel?: (input: string) => ReactNode;
  onChange?: (value: string | null) => void;
  popoverContentClassName?: string;
  'data-testid'?: string;
  'aria-label'?: string;
}

export default function FormAutocomplete<
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
  ...coreProps
}: FormAutocompleteProps<TFieldValues, TName>) {
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
            <FormAutocompleteCore
              {...coreProps}
              value={field.value ?? null}
              onChange={(next) => {
                field.onChange(next);
                onChangeProp?.(next);
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
