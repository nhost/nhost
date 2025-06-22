import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Text } from '@/components/ui/v2/Text';
import { Button as ButtonV3 } from '@/components/ui/v3/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/v3/command';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/v3/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import { convertIntrospectionToSchema } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaPreview/utils';
import { useIntrospectRemoteSchemaQuery } from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery';
import { cn } from '@/lib/utils';
import { isObjectType } from 'graphql';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import type { DatabaseRelationshipFormValues } from './DatabaseRelationshipForm';

export interface FieldToColumnMapSelectorProps {
  sourceSchema: string;
}

export default function FieldToColumnMapSelector({
  sourceSchema,
}: FieldToColumnMapSelectorProps) {
  const form = useFormContext<DatabaseRelationshipFormValues>();

  const tableInfo = form.watch('table');
  const { schema, name: table } = tableInfo;

  // Watch the selected source type to get its fields
  const selectedSourceType = form.watch('sourceType');

  // Introspect the source remote schema to get its types
  const { data: introspectionData } = useIntrospectRemoteSchemaQuery(
    sourceSchema,
    {
      queryOptions: {
        enabled: !!sourceSchema,
      },
    },
  );

  // Extract fields from the selected source type
  const sourceFields =
    introspectionData && selectedSourceType
      ? (() => {
          const graphqlSchema = convertIntrospectionToSchema(introspectionData);
          const type = graphqlSchema.getType(selectedSourceType);

          if (isObjectType(type)) {
            const fields = type.getFields();
            return Object.keys(fields).map((fieldName) => ({
              label: fieldName,
              value: fieldName,
              type: fields[fieldName].type.toString(), // For display purposes
            }));
          }

          return [];
        })()
      : [];

  const { data } = useTableQuery([`default.${schema}.${table}`], {
    schema,
    table,
    queryOptions: {
      enabled: !!schema && !!table,
    },
  });

  const columns =
    data?.columns
      ?.map((column) => (column.column_name as string) ?? null)
      .filter(Boolean) ?? [];

  console.log('columns', columns);
  console.log('sourceFields', sourceFields);

  const { fields, append, remove } =
    useFieldArray<DatabaseRelationshipFormValues>({
      name: 'fieldMapping',
    });

  // Get currently selected source fields to prevent duplicates
  const fieldMappings = form.watch('fieldMapping');

  // Function to get available source fields for a specific row index
  const getAvailableSourceFields = (currentIndex: number) => {
    const selectedFieldsInOtherRows = fieldMappings
      .map((mapping, index) =>
        index !== currentIndex ? mapping.sourceField : null,
      )
      .filter(Boolean);

    return sourceFields.filter(
      (field) => !selectedFieldsInOtherRows.includes(field.value),
    );
  };

  return (
    <Box className="space-y-4 rounded border-1 p-4">
      <Box className="flex flex-col space-y-4">
        <Box className="grid grid-cols-8 items-center gap-4">
          <Text className="col-span-3">Source Field</Text>
          <div className="col-span-1" />
          <Text className="col-span-3">Reference Column</Text>
          <Button
            variant="borderless"
            className="col-span-1"
            onClick={() => append({ sourceField: '', referenceColumn: '' })}
          >
            <PlusIcon className="h-5 w-5" />
          </Button>
        </Box>

        {fields.map((field, index) => (
          <Box key={field.id} className="grid grid-cols-8 items-center gap-4">
            <FormField
              control={form.control}
              name={`fieldMapping.${index}.sourceField`}
              render={({ field: sourceFieldControl }) => (
                <FormItem className="col-span-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <ButtonV3
                          variant="outline"
                          role="combobox"
                          className={cn(
                            'w-full justify-between',
                            !sourceFieldControl.value &&
                              'text-muted-foreground',
                          )}
                        >
                          {sourceFieldControl.value
                            ? sourceFields.find(
                                (sourceField) =>
                                  sourceField.value ===
                                  sourceFieldControl.value,
                              )?.label
                            : 'Select field'}
                          <ChevronsUpDown className="opacity-50" />
                        </ButtonV3>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search field..."
                          className="h-9"
                        />
                        <CommandList>
                          <CommandEmpty>
                            Select a source type first.
                          </CommandEmpty>
                          <CommandGroup>
                            {getAvailableSourceFields(index).map(
                              (sourceField) => (
                                <CommandItem
                                  value={sourceField.value}
                                  key={sourceField.value}
                                  onSelect={() => {
                                    sourceFieldControl.onChange(
                                      sourceField.value,
                                    );
                                  }}
                                >
                                  {sourceField.label} ({sourceField.type})
                                  <Check
                                    className={cn(
                                      'ml-auto',
                                      sourceField.value ===
                                        sourceFieldControl.value
                                        ? 'opacity-100'
                                        : 'opacity-0',
                                    )}
                                  />
                                </CommandItem>
                              ),
                            )}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Text className="col-span-1 text-center">:</Text>

            <FormField
              control={form.control}
              name={`fieldMapping.${index}.referenceColumn`}
              render={({ field: columnField }) => (
                <FormItem className="col-span-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <ButtonV3
                          variant="outline"
                          role="combobox"
                          className={cn(
                            'w-full justify-between',
                            !columnField.value && 'text-muted-foreground',
                          )}
                        >
                          {columnField.value
                            ? columns.find(
                                (column) => column === columnField.value,
                              )
                            : 'Select column'}
                          <ChevronsUpDown className="opacity-50" />
                        </ButtonV3>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search column..."
                          className="h-9"
                        />
                        <CommandList>
                          <CommandEmpty>
                            Select a target table first.
                          </CommandEmpty>
                          <CommandGroup>
                            {columns?.map((column) => (
                              <CommandItem
                                value={column}
                                key={column}
                                onSelect={() => {
                                  columnField.onChange(column);
                                }}
                              >
                                {column}
                                <Check
                                  className={cn(
                                    'ml-auto',
                                    column === columnField.value
                                      ? 'opacity-100'
                                      : 'opacity-0',
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              variant="borderless"
              className="col-span-1"
              color="error"
              onClick={() => remove(index)}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
