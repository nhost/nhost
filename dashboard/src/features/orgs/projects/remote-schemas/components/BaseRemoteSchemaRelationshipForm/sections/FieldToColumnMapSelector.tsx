import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
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
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import type { DatabaseRelationshipFormValues } from './DatabaseRelationshipForm';

export default function FieldToColumnMapSelector() {
  const form = useFormContext<DatabaseRelationshipFormValues>();

  const tableInfo = form.watch('table');
  const { schema, name: table } = tableInfo;

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

  const {
    register,
    setValue,
    formState: { errors },
    watch,
  } = form;

  const { fields, append, remove } =
    useFieldArray<DatabaseRelationshipFormValues>({
      name: 'fieldMapping',
    });

  const handleRemoveHeader = (index: number, fieldId: string) => {
    remove(index);
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
            <Input
              {...register(`fieldMapping.${index}.sourceField`)}
              id={`${field.id}-name`}
              placeholder="Source field"
              className="col-span-3"
              hideEmptyHelperText
              error={!!errors?.fieldMapping?.at(index)?.sourceField}
              helperText={errors?.fieldMapping?.at(index)?.sourceField?.message}
              fullWidth
              autoComplete="off"
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
              onClick={() => handleRemoveHeader(index, field.id)}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
