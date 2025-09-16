import { Text } from '@/components/ui/v2/Text';
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
  FormMessage,
} from '@/components/ui/v3/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import type { DatabaseRelationshipFormValues } from './DatabaseRelationshipForm';

export interface FieldToColumnMapSelectorItemProps {
  itemIndex: number;
  sourceFields: { label: string; value: string; type: string }[];
  columns: string[];
  disabled?: boolean;
}

export default function FieldToColumnMapSelectorItem({
  itemIndex,
  sourceFields,
  columns,
  disabled,
}: FieldToColumnMapSelectorItemProps) {
  const form = useFormContext<DatabaseRelationshipFormValues>();

  const [sourceFieldOpen, setSourceFieldOpen] = useState(false);
  const [referenceColumnOpen, setReferenceColumnOpen] = useState(false);

  const fieldMappings = form.watch('fieldMapping');

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
    <>
      <FormField
        control={form.control}
        name={`fieldMapping.${itemIndex}.sourceField`}
        render={({ field: sourceFieldControl }) => (
          <FormItem className="col-span-3">
            <Popover open={sourceFieldOpen} onOpenChange={setSourceFieldOpen}>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      'w-full justify-between',
                      !sourceFieldControl.value && 'text-muted-foreground',
                    )}
                    disabled={disabled}
                  >
                    {sourceFieldControl.value
                      ? sourceFields.find(
                          (sourceField) =>
                            sourceField.value === sourceFieldControl.value,
                        )?.label
                      : 'Select field'}
                    <ChevronsUpDown className="opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search field..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>Select a source type first.</CommandEmpty>
                    <CommandGroup>
                      {getAvailableSourceFields(itemIndex).map(
                        (sourceField) => (
                          <CommandItem
                            value={sourceField.value}
                            key={sourceField.value}
                            onSelect={() => {
                              sourceFieldControl.onChange(sourceField.value);
                              setSourceFieldOpen(false);
                            }}
                          >
                            {sourceField.label} ({sourceField.type})
                            <Check
                              className={cn(
                                'ml-auto',
                                sourceField.value === sourceFieldControl.value
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
        name={`fieldMapping.${itemIndex}.referenceColumn`}
        render={({ field: columnField }) => (
          <FormItem className="col-span-3">
            <Popover
              open={referenceColumnOpen}
              onOpenChange={setReferenceColumnOpen}
            >
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      'w-full justify-between',
                      !columnField.value && 'text-muted-foreground',
                    )}
                    disabled={disabled}
                  >
                    {columnField.value
                      ? columns.find((column) => column === columnField.value)
                      : 'Select column'}
                    <ChevronsUpDown className="opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput
                    placeholder="Search column..."
                    className="h-9"
                  />
                  <CommandList>
                    <CommandEmpty>Select a target table first.</CommandEmpty>
                    <CommandGroup>
                      {columns?.map((column) => (
                        <CommandItem
                          value={column}
                          key={column}
                          onSelect={() => {
                            columnField.onChange(column);
                            setReferenceColumnOpen(false);
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
    </>
  );
}
