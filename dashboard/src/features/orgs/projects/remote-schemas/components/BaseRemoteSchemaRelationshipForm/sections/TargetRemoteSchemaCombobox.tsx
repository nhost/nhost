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
import type { RemoteSchemaInfo } from '@/utils/hasura-api/generated/schemas';
import type { RemoteSchemaRelationshipFormValues } from './RemoteSchemaRelationshipForm';

export interface TargetRemoteSchemaComboboxProps {
  disabled?: boolean;
  remoteSchemas: RemoteSchemaInfo[];
}

export default function TargetRemoteSchemaCombobox({
  disabled,
  remoteSchemas,
}: TargetRemoteSchemaComboboxProps) {
  const [open, setOpen] = useState(false);
  const form = useFormContext<RemoteSchemaRelationshipFormValues>();

  return (
    <FormField
      control={form.control}
      name="targetRemoteSchema"
      render={({ field }) => (
        <FormItem className="flex flex-1 flex-col">
          <FormLabel>Target Remote Schema</FormLabel>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  disabled={disabled}
                  variant="outline"
                  role="combobox"
                  className={cn(
                    'w-full justify-between',
                    !field.value && 'text-muted-foreground',
                    {
                      'border-destructive':
                        form.formState.errors.targetRemoteSchema,
                    },
                  )}
                >
                  {field.value
                    ? remoteSchemas.find(
                        (schema) => schema.name === field.value,
                      )?.name
                    : 'Select remote schema'}
                  <ChevronsUpDown className="opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
              <Command>
                <CommandInput
                  placeholder="Search remote schema..."
                  className="h-9"
                />
                <CommandList>
                  <CommandEmpty>No remote schema found.</CommandEmpty>
                  <CommandGroup>
                    {remoteSchemas.map((schema) => (
                      <CommandItem
                        value={schema.name}
                        key={schema.name}
                        onSelect={() => {
                          form.setValue('targetRemoteSchema', schema.name, {
                            shouldValidate: true,
                            shouldDirty: true,
                            shouldTouch: true,
                          });
                          setOpen(false);
                        }}
                      >
                        {schema.name}
                        <Check
                          className={cn(
                            'ml-auto',
                            schema.name === field.value
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
