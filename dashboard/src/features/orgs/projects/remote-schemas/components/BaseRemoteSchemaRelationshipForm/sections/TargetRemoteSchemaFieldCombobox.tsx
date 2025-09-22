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
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import type { RemoteSchemaRelationshipFormValues } from './RemoteSchemaRelationshipForm';

export interface TargetRemoteSchemaFieldComboboxProps {
  disabled?: boolean;
  targetFields: { label: string; value: string }[];
}

export default function TargetRemoteSchemaFieldCombobox({
  disabled,
  targetFields,
}: TargetRemoteSchemaFieldComboboxProps) {
  const form = useFormContext<RemoteSchemaRelationshipFormValues>();
  const [open, setOpen] = useState(false);

  return (
    <FormField
      control={form.control}
      name="targetField"
      render={({ field }) => (
        <FormItem className="flex flex-1 flex-col">
          <FormLabel>Target Remote Schema Field</FormLabel>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant="outline"
                  disabled={disabled}
                  role="combobox"
                  className={cn(
                    'w-full justify-between',
                    !field.value && 'text-muted-foreground',
                    { 'border-destructive': form.formState.errors.targetField },
                  )}
                >
                  {field.value
                    ? targetFields.find(
                        (fieldItem) => fieldItem.value === field.value,
                      )?.label
                    : 'Select field'}
                  <ChevronsUpDown className="opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
              <Command>
                <CommandInput
                  placeholder="Search target field..."
                  className="h-9"
                />
                <CommandList>
                  <CommandEmpty>No target field found.</CommandEmpty>
                  <CommandGroup>
                    {targetFields.map((fieldItem) => (
                      <CommandItem
                        value={fieldItem.label}
                        key={fieldItem.value}
                        onSelect={() => {
                          form.setValue('targetField', fieldItem.value, {
                            shouldValidate: true,
                            shouldDirty: true,
                            shouldTouch: true,
                          });
                          setOpen(false);
                        }}
                      >
                        {fieldItem.label}
                        <Check
                          className={cn(
                            'ml-auto',
                            fieldItem.value === field.value
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
