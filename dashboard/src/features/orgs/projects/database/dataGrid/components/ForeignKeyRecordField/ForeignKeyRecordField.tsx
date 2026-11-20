import { KeyRound, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/v3/command';
import { FormField, FormItem, FormLabel } from '@/components/ui/v3/form';
import { InlineCode } from '@/components/ui/v3/inline-code';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/v3/input-group';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import type { ForeignKeyRow } from '@/features/orgs/projects/database/dataGrid/hooks/useForeignKeyRowsQuery/fetchForeignKeyRows';
import useForeignKeyRowsQuery from '@/features/orgs/projects/database/dataGrid/hooks/useForeignKeyRowsQuery/useForeignKeyRowsQuery';
import type {
  DataBrowserColumnMetadata,
  ForeignKeyRelation,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { formatPickerKeys } from '@/features/orgs/projects/database/dataGrid/utils/foreignKeyPicker';
import { POSTGRES_DEFAULT_PLACEHOLDER } from '@/features/orgs/projects/database/dataGrid/utils/postgresDefaultPlaceholder';
import {
  getCreateRecordFormDefaultValues,
  getRecordFormValue,
} from '@/features/orgs/projects/database/dataGrid/utils/recordFormValues';
import { cn } from '@/lib/utils';

interface ForeignKeyRecordFieldProps {
  columns: DataBrowserColumnMetadata[];
  relation: ForeignKeyRelation;
  autoFocus?: boolean;
}

function requiresManualValue(column: DataBrowserColumnMetadata) {
  return !column.isNullable && !column.defaultValue && !column.isIdentity;
}

export default function ForeignKeyRecordField({
  columns,
  relation,
  autoFocus,
}: ForeignKeyRecordFieldProps) {
  const { control, setValue, getFieldState, formState } = useFormContext();
  const values = useWatch({
    control,
    name: columns.map((column) => column.id),
  });
  const [selection, setSelection] = useState<ForeignKeyRow | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreInputFocus = useRef(false);
  const id = useId();
  const helperId = `${id}-helper`;
  const tableLabel = relation.referencedSchema
    ? `${relation.referencedSchema}.${relation.referencedTable}`
    : relation.referencedTable;
  const { data, unavailable, isLoading, isFetching } = useForeignKeyRowsQuery(
    relation,
    debouncedSearch,
    open,
  );
  const pending = search !== debouncedSearch || isLoading || isFetching;
  const selected = selection?.values.every(
    (value, index) => value === values[index],
  );

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (selection === null && restoreInputFocus.current) {
      restoreInputFocus.current = false;
      inputRef.current?.focus();
    }
  }, [selection]);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setSearch('');
      setDebouncedSearch('');
    }
  }

  function pickRow(row: ForeignKeyRow) {
    columns.forEach((column, index) => {
      setValue(column.id, getRecordFormValue(column, row.values[index]), {
        shouldDirty: true,
        shouldValidate: true,
        shouldTouch: true,
      });
    });
    setSelection(row);
    setOpen(false);
  }

  function clearSelection() {
    const defaults = getCreateRecordFormDefaultValues(columns);
    columns.forEach((column) => {
      setValue(column.id, defaults[column.id], {
        shouldDirty: true,
        shouldValidate: true,
      });
    });
    restoreInputFocus.current = true;
    setSelection(null);
  }

  const filledValues = columns.flatMap((column, index) => {
    const value = values[index];
    if (
      value === null ||
      value === undefined ||
      value === POSTGRES_DEFAULT_PLACEHOLDER ||
      (!column.isArray && column.baseType === 'boolean' && value === 'null')
    ) {
      return [];
    }
    return [`${column.id} ${String(value)}`];
  });

  return (
    <fieldset className="flex w-full min-w-0 gap-4 py-3">
      <legend className="sr-only">
        {columns.map((column) => column.id).join(' + ')}
      </legend>
      <div className="mt-2 w-52 shrink-0 space-y-1 text-sm">
        {columns.map((column) => (
          <div key={column.id} className="flex flex-wrap items-center gap-1">
            {column.isPrimary && (
              <KeyRound
                className="size-3 text-muted-foreground"
                aria-label="Primary key"
              />
            )}
            <label
              htmlFor={`${id}-${column.id}`}
              className="break-all font-medium"
            >
              {column.id}
              {requiresManualValue(column) && (
                <span className="sr-only"> (required)</span>
              )}
            </label>
            <InlineCode title={column.specificType}>
              {column.displayType}
            </InlineCode>
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <Popover open={open} onOpenChange={changeOpen}>
          <PopoverAnchor asChild>
            <InputGroup className="h-auto min-h-10 bg-transparent md:h-auto dark:bg-transparent">
              <div
                className={cn(
                  'flex min-w-0 flex-1 divide-x',
                  selected && 'hidden',
                )}
              >
                {columns.map((column, index) => {
                  const hasDefault = Boolean(
                    column.defaultValue || column.isIdentity,
                  );
                  const value = values[index];
                  const isNull =
                    value === null ||
                    (!column.isArray &&
                      column.baseType === 'boolean' &&
                      value === 'null');
                  const isDefault = value === POSTGRES_DEFAULT_PLACEHOLDER;
                  return (
                    <FormField
                      key={column.id}
                      control={control}
                      name={column.id}
                      render={({ field, fieldState }) => (
                        <FormItem className="min-w-0 flex-1 space-y-0">
                          {columns.length > 1 && (
                            <FormLabel
                              htmlFor={`${id}-${column.id}`}
                              className="block px-3 pt-2 text-muted-foreground text-xs"
                            >
                              {column.id}
                              {requiresManualValue(column) ? ' *' : ''}
                            </FormLabel>
                          )}
                          <InputGroupInput
                            {...field}
                            id={`${id}-${column.id}`}
                            ref={(element) => {
                              field.ref(element);
                              if (index === 0) {
                                inputRef.current = element;
                              }
                            }}
                            aria-describedby={helperId}
                            aria-invalid={Boolean(fieldState.error)}
                            aria-required={requiresManualValue(column)}
                            value={
                              isNull || isDefault ? '' : (field.value ?? '')
                            }
                            placeholder={
                              isDefault
                                ? 'DEFAULT'
                                : isNull && column.isNullable
                                  ? 'NULL'
                                  : undefined
                            }
                            onChange={(event) => {
                              setSelection(null);
                              const text = event.target.value;
                              field.onChange(
                                text === '' &&
                                  !(column.isNullable && hasDefault)
                                  ? getCreateRecordFormDefaultValues([column])[
                                      column.id
                                    ]
                                  : text,
                              );
                            }}
                          />
                          {(column.isNullable || hasDefault) && (
                            <div className="flex flex-wrap gap-1 px-2 pb-1">
                              {column.isNullable && (
                                <InputGroupButton
                                  aria-label={`Set ${column.id} to NULL`}
                                  aria-pressed={isNull}
                                  onClick={() => {
                                    setSelection(null);
                                    field.onChange(
                                      getRecordFormValue(column, null),
                                    );
                                  }}
                                >
                                  NULL
                                </InputGroupButton>
                              )}
                              {hasDefault && (
                                <InputGroupButton
                                  aria-label={`Use default for ${column.id}`}
                                  aria-pressed={isDefault}
                                  onClick={() => {
                                    setSelection(null);
                                    field.onChange(
                                      POSTGRES_DEFAULT_PLACEHOLDER,
                                    );
                                  }}
                                >
                                  DEFAULT
                                </InputGroupButton>
                              )}
                            </div>
                          )}
                        </FormItem>
                      )}
                    />
                  );
                })}
              </div>
              {selected && selection && (
                <div className="flex min-w-0 flex-1 items-center gap-1 p-1">
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="subtle"
                      ref={triggerRef}
                      size="sm"
                      className="min-w-0 justify-start"
                      aria-label={`Replace linked row ${selection.label || selection.values.join(' · ')}`}
                    >
                      <span className="truncate">
                        {selection.label || selection.values.join(' · ')}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <InputGroupButton
                    size="icon-sm"
                    aria-label="Clear linked row"
                    onClick={clearSelection}
                    className="shrink-0 hover:text-destructive"
                  >
                    <X className="size-4" />
                  </InputGroupButton>
                </div>
              )}
              {!selected && (
                <InputGroupAddon align="inline-end">
                  <PopoverTrigger asChild>
                    <InputGroupButton
                      size="icon-sm"
                      aria-label={`Search ${tableLabel}`}
                      ref={triggerRef}
                    >
                      <Search className="size-4" />
                    </InputGroupButton>
                  </PopoverTrigger>
                </InputGroupAddon>
              )}
            </InputGroup>
          </PopoverAnchor>
          <PopoverContent
            align="start"
            className="w-96 max-w-full p-0"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              triggerRef.current?.focus();
            }}
          >
            <Command shouldFilter={false}>
              <CommandInput
                autoFocus
                aria-label={`Search rows in ${tableLabel}`}
                placeholder="Search by label or key…"
                value={search}
                onValueChange={setSearch}
              />
              <CommandList aria-label={`Rows in ${tableLabel}`}>
                {unavailable ? (
                  <p
                    role="status"
                    className="p-4 text-muted-foreground text-sm"
                  >
                    Unable to load linked rows. You can still enter values
                    manually.
                  </p>
                ) : pending ? (
                  <p
                    role="status"
                    className="p-4 text-muted-foreground text-sm"
                  >
                    Loading rows…
                  </p>
                ) : !data?.rows.length ? (
                  <p
                    role="status"
                    className="p-4 text-muted-foreground text-sm"
                  >
                    {search ? 'No matching rows.' : 'No rows available.'}
                  </p>
                ) : (
                  data.rows.map((row) => (
                    <CommandItem
                      key={JSON.stringify(row.values)}
                      value={JSON.stringify(row.values)}
                      className="flex-col items-start gap-1"
                      onSelect={() => pickRow(row)}
                    >
                      <span className="w-full truncate">
                        {row.label || row.values.join(' · ')}
                      </span>
                      <span className="w-full truncate font-mono text-muted-foreground text-xs">
                        {formatPickerKeys(
                          relation.referencedColumns,
                          row.values,
                        )}
                      </span>
                    </CommandItem>
                  ))
                )}
              </CommandList>
              {!pending && !unavailable && data?.hasMore && (
                <p className="border-t px-3 py-2 text-muted-foreground text-xs">
                  Showing 20 rows. Refine your search for more.
                </p>
              )}
            </Command>
          </PopoverContent>
        </Popover>
        <p id={helperId} className="break-words text-muted-foreground text-xs">
          {[tableLabel, ...filledValues].join(' · ')}
        </p>
        {columns.map((column) => {
          const error = getFieldState(column.id, formState).error;
          return (
            <div key={column.id}>
              {column.comment && (
                <p className="text-muted-foreground text-xs">
                  {column.comment}
                </p>
              )}
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {column.id}: {error.message}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
