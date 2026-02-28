import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
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
import { Input } from '@/components/ui/v3/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { cn } from '@/lib/utils';
import type { RemoteSchemaRelationshipFormValues } from './RemoteSchemaRelationshipForm';

export interface SchemaToArgumentMapSelectorValueProps {
  mappingIndex: number;
  currentType: 'sourceTypeField' | 'staticValue' | null;
  sourceFields: { label: string; value: string; type: string }[];
  disabled?: boolean;
}

export default function SchemaToArgumentMapSelectorValue({
  mappingIndex,
  currentType,
  sourceFields,
  disabled,
}: SchemaToArgumentMapSelectorValueProps) {
  const form = useFormContext<RemoteSchemaRelationshipFormValues>();

  const [open, setOpen] = useState(false);

  return (
    <FormField
      control={form.control}
      name={`mappings.${mappingIndex}.value`}
      render={({ field: valueField }) => (
        <FormItem className="flex-1">
          {currentType === 'sourceTypeField' ? (
            <>
              <FormLabel>From Source Type Field</FormLabel>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      disabled={disabled}
                      className={cn(
                        'w-full justify-between rounded-l-none',
                        !valueField.value && 'text-muted-foreground',
                      )}
                    >
                      {valueField.value
                        ? sourceFields.find(
                            (field) => field.value === valueField.value,
                          )?.label
                        : 'Select source field'}
                      <ChevronsUpDown className="opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search field..."
                      className="h-9"
                    />
                    <CommandList>
                      <CommandEmpty>No source fields found.</CommandEmpty>
                      <CommandGroup>
                        {sourceFields.map((field) => (
                          <CommandItem
                            value={field.value}
                            key={field.value}
                            onSelect={() => {
                              valueField.onChange(field.value);
                              setOpen(false);
                            }}
                          >
                            {field.label} ({field.type})
                            <Check
                              className={cn(
                                'ml-auto',
                                field.value === valueField.value
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
            </>
          ) : (
            <>
              <FormLabel>Static Value</FormLabel>
              <Input
                {...valueField}
                placeholder="Enter static value"
                className="rounded-l-none"
                disabled={disabled}
              />
            </>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
