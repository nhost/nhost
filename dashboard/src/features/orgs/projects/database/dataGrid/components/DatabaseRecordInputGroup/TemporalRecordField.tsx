import type { ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import { ButtonGroup } from '@/components/ui/v3/button-group';
import {
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { POSTGRES_DEFAULT_PLACEHOLDER } from '@/features/orgs/projects/database/dataGrid/utils/postgresDefaultPlaceholder';
import { cn } from '@/lib/utils';
import TemporalPicker from './TemporalPicker';

interface TemporalRecordFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label: ReactNode;
  baseType?: string | null;
  isNullable?: boolean;
  hasDefault?: boolean;
  placeholder?: string;
  helperText?: string | null;
  inline?: boolean;
}

export default function TemporalRecordField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  baseType,
  isNullable = false,
  hasDefault = false,
  placeholder,
  helperText,
  inline,
}: TemporalRecordFieldProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const isNull = field.value === null;
        const isSentinelDefault = field.value === POSTGRES_DEFAULT_PLACEHOLDER;
        const showDefault =
          isSentinelDefault || (isNull && hasDefault && !isNullable);
        const pickerValue = isSentinelDefault
          ? null
          : (field.value as string | null);

        let emptyLabel: string | undefined;
        if (showDefault) {
          emptyLabel = placeholder ?? 'DEFAULT';
        } else if (isNull && isNullable) {
          emptyLabel = 'NULL';
        }

        return (
          <FormItem
            className={cn({ 'flex w-full items-center gap-4 py-3': inline })}
          >
            <FormLabel
              htmlFor={name as string}
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
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <TemporalPicker
                    id={name as string}
                    baseType={baseType}
                    value={pickerValue}
                    onChange={field.onChange}
                    emptyLabel={emptyLabel}
                    error={!!fieldState.error}
                  />
                </div>
                {(isNullable || hasDefault) && (
                  <ButtonGroup>
                    {isNullable && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => field.onChange(null)}
                        aria-pressed={isNull}
                      >
                        NULL
                      </Button>
                    )}
                    {hasDefault && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          field.onChange(POSTGRES_DEFAULT_PLACEHOLDER)
                        }
                        aria-pressed={showDefault}
                      >
                        DEFAULT
                      </Button>
                    )}
                  </ButtonGroup>
                )}
              </div>
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
