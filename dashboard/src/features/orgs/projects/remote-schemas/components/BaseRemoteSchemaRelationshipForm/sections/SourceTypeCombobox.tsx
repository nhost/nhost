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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { cn } from '@/lib/utils';
import type { DatabaseRelationshipFormValues } from './DatabaseRelationshipForm';
import type { RemoteSchemaRelationshipFormValues } from './RemoteSchemaRelationshipForm';

export interface SourceTypeComboboxProps {
  disabled?: boolean;
  sourceTypes: { label: string; value: string }[];
}

export default function SourceTypeCombobox({
  disabled,
  sourceTypes,
}: SourceTypeComboboxProps) {
  const form = useFormContext<
    DatabaseRelationshipFormValues | RemoteSchemaRelationshipFormValues
  >();
  const [open, setOpen] = useState(false);

  return (
    <FormField
      control={form.control}
      name="sourceType"
      render={({ field }) => (
        <FormItem className="flex flex-1 flex-col">
          <FormLabel>Source Type</FormLabel>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant="outline"
                  role="combobox"
                  disabled={disabled}
                  className={cn(
                    'w-full justify-between',
                    !field.value && 'text-muted-foreground',
                    { 'border-destructive': form.formState.errors.sourceType },
                  )}
                >
                  {field.value
                    ? sourceTypes.find((type) => type.value === field.value)
                        ?.label
                    : 'Select type'}
                  <ChevronsUpDown className="opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
              <Command>
                <CommandInput
                  placeholder="Search source type..."
                  className="h-9"
                />
                <CommandList>
                  <CommandEmpty>No source type found.</CommandEmpty>
                  <CommandGroup>
                    {sourceTypes.map((type) => (
                      <CommandItem
                        value={type.label}
                        key={type.value}
                        onSelect={() => {
                          form.setValue('sourceType', type.value, {
                            shouldValidate: true,
                            shouldDirty: true,
                            shouldTouch: true,
                          });
                          setOpen(false);
                        }}
                      >
                        {type.label}
                        <Check
                          className={cn(
                            'ml-auto',
                            type.value === field.value
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
