import type { ReactNode } from 'react';
import { useMemo } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import { ButtonGroup } from '@/components/ui/v3/button-group';
import type { ComboboxOption } from '@/components/ui/v3/combobox';
import {
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { FreeCombobox } from '@/components/ui/v3/free-combobox';
import useTableQuery from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery/useTableQuery';
import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { POSTGRES_DEFAULT_PLACEHOLDER } from '@/features/orgs/projects/database/dataGrid/utils/postgresDefaultPlaceholder';
import { cn } from '@/lib/utils';

export interface ForeignKeyRecordFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label: ReactNode;
  foreignKeyRelation: ForeignKeyRelation;
  isNullable?: boolean;
  hasDefault?: boolean;
  placeholder?: string;
  helperText?: string | null;
  inline?: boolean;
  className?: string;
}

const DESCRIPTIVE_KEYS = [
  'name',
  'title',
  'label',
  'email',
  'username',
  'slug',
  'description',
  'full_name',
  'first_name',
];

export default function ForeignKeyRecordField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  foreignKeyRelation,
  isNullable = false,
  hasDefault = false,
  placeholder,
  helperText,
  inline,
  className,
}: ForeignKeyRecordFieldProps<TFieldValues, TName>) {
  const referencedSchema = foreignKeyRelation.referencedSchema || 'public';
  const referencedTable = foreignKeyRelation.referencedTable;
  const referencedColumn = foreignKeyRelation.referencedColumn;

  const { data, isLoading } = useTableQuery(
    ['foreign-key-rows', referencedSchema, referencedTable],
    {
      schema: referencedSchema,
      table: referencedTable,
      limit: 100,
    },
  );

  const options: ComboboxOption[] = useMemo(() => {
    if (!data?.rows || data.rows.length === 0) {
      return [];
    }

    return data.rows.map((row) => {
      const colValue = row[referencedColumn];
      const stringValue = String(colValue ?? '');

      const secondaryKey = Object.keys(row).find(
        (key) =>
          key !== referencedColumn &&
          DESCRIPTIVE_KEYS.includes(key.toLowerCase()) &&
          row[key] != null &&
          row[key] !== '',
      );

      const secondaryValue = secondaryKey ? String(row[secondaryKey]) : null;
      const optionLabel = secondaryValue
        ? `${stringValue} (${secondaryValue})`
        : stringValue;

      return {
        value: stringValue,
        label: optionLabel,
      };
    });
  }, [data?.rows, referencedColumn]);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const isNull = field.value === null;
        const isSentinelDefault = field.value === POSTGRES_DEFAULT_PLACEHOLDER;
        const showDefault =
          isSentinelDefault || (isNull && hasDefault && !isNullable);

        let inputPlaceholder: string;
        if (showDefault) {
          inputPlaceholder = placeholder ?? 'DEFAULT';
        } else if (isNull && isNullable) {
          inputPlaceholder = 'NULL';
        } else {
          inputPlaceholder =
            placeholder ??
            `Select or enter ${referencedTable}.${referencedColumn}...`;
        }

        const displayValue =
          isSentinelDefault || isNull ? null : (field.value as string | null);

        function handleSetNull() {
          field.onChange(null);
        }

        function handleSetDefault() {
          field.onChange(POSTGRES_DEFAULT_PLACEHOLDER);
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
                  <FreeCombobox
                    options={options}
                    value={displayValue}
                    onChange={(nextValue) => {
                      field.onChange(nextValue);
                    }}
                    onBlur={field.onBlur}
                    placeholder={inputPlaceholder}
                    searchPlaceholder={
                      isLoading
                        ? 'Loading records...'
                        : `Search ${referencedTable}...`
                    }
                    emptyText={
                      isLoading
                        ? 'Loading records...'
                        : 'No matching records found'
                    }
                    customValueLabel={(input) => `Use "${input}"`}
                    disabled={false}
                    aria-invalid={!!fieldState.error}
                    className={className}
                  />
                </div>
                {(isNullable || hasDefault) && (
                  <ButtonGroup>
                    {isNullable && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-pressed={isNull}
                        onClick={handleSetNull}
                      >
                        NULL
                      </Button>
                    )}
                    {hasDefault && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-pressed={isSentinelDefault}
                        onClick={handleSetDefault}
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
