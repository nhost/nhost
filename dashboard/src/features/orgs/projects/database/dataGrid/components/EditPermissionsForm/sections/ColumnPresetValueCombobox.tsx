import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { useController, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import {
  Command,
  CommandCreateItem,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/v3/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { cn } from '@/lib/utils';

interface VariableOption {
  value: string;
  label: string;
}

interface ColumnPresetValueComboboxProps {
  name: string;
  options: VariableOption[];
  hasError?: boolean;
}

export default function ColumnPresetValueCombobox({
  name,
  options,
  hasError,
}: ColumnPresetValueComboboxProps) {
  const { control } = useFormContext();
  const { field } = useController({ name, control });
  const [open, setOpen] = useState(false);

  const triggerLabel = field.value || 'Select value';

  function commit(value: string) {
    field.onChange(value);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between font-normal',
            !field.value && 'text-muted-foreground',
            hasError && 'border-destructive text-destructive',
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command>
          <CommandInput placeholder="Type value or search variable" />
          <CommandList>
            <CommandEmpty>No variable found.</CommandEmpty>
            {options.length > 0 && (
              <CommandGroup heading="Permission variables">
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => commit(opt.value)}
                  >
                    {opt.label}
                    <Check
                      className={cn(
                        'ml-auto h-4 w-4',
                        field.value === opt.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandCreateItem onCreate={commit} />
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
