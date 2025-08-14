import { Button } from '@/components/ui/v3/button';
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
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import type { DatabaseRelationshipFormValues } from './DatabaseRelationshipForm';

export interface TargetTableComboboxProps {
  disabled?: boolean;
}

export default function TargetTableCombobox({
  disabled,
}: TargetTableComboboxProps) {
  const form = useFormContext<DatabaseRelationshipFormValues>();

  // TODO: Support multiple data sources
  const { data } = useDatabaseQuery(['default'], {
    dataSource: 'default',
  });

  const handleSelectTable = (table: { name: string; schema: string }) => {
    form.setValue('table', table);

    // Reset the reference column for all fields, when changing the target table
    if (form.getValues('fieldMapping').length > 0) {
      form.setValue(
        'fieldMapping',
        form.getValues('fieldMapping').map((field) => ({
          ...field,
          referenceColumn: '',
        })),
      );
    }
  };

  const tables = (data?.tables ?? []).flatMap((table) =>
    table.table_name && table.table_schema
      ? [
          {
            label: `default / ${table.table_schema} / ${table.table_name}`,
            value: {
              name: table.table_name,
              schema: table.table_schema,
            },
          },
        ]
      : [],
  );

  return (
    <FormField
      control={form.control}
      name="table"
      render={({ field }) => (
        <FormItem className="flex flex-1 flex-col">
          <FormLabel>Target Table</FormLabel>
          <Popover>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    'w-full justify-between',
                    (!field.value?.name || !field.value?.schema) &&
                      'text-muted-foreground',
                  )}
                  disabled={disabled}
                >
                  {field.value?.name && field.value?.schema
                    ? tables.find(
                        (table) =>
                          table.value.name === field.value?.name &&
                          table.value.schema === field.value?.schema,
                      )?.label
                    : 'Select table'}
                  <ChevronsUpDown className="opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
              <Command>
                <CommandInput
                  placeholder="Search target table..."
                  className="h-9"
                />
                <CommandList>
                  <CommandEmpty>No target table found.</CommandEmpty>
                  <CommandGroup>
                    {tables.map((table) => (
                      <CommandItem
                        value={table.label}
                        key={`${table.value.schema}/${table.value.name}`}
                        onSelect={() => handleSelectTable(table.value)}
                      >
                        {table.label}
                        <Check
                          className={cn(
                            'ml-auto',
                            table.value.name === field.value?.name &&
                              table.value.schema === field.value?.schema
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
  );
}
