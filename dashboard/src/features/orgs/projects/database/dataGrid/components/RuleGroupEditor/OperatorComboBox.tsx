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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { cn } from '@/lib/utils';
import { getAvailableOperators } from './getAvailableOperators';

interface OperatorComboBoxProps {
  name: string;
  disabled?: boolean;
  selectedColumnType?: string;
}

export default function OperatorComboBox({
  name,
  disabled,
  selectedColumnType,
}: OperatorComboBoxProps) {
  const [open, setOpen] = useState(false);
  const { watch, setValue, clearErrors } = useFormContext();

  const operator = watch(`${name}.operator`);

  const availableOperators = getAvailableOperators(selectedColumnType);

  const maxOperatorLength = Math.max(
    ...availableOperators.map((op) => op.value.length),
  );

  const handleSelect = (value: string) => {
    const newValue = ['_in', '_nin'].includes(value) ? [] : null;
    setValue(`${name}.value`, newValue, { shouldDirty: true });
    setValue(`${name}.operator`, value, { shouldDirty: true });
    clearErrors();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          disabled={disabled}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between"
        >
          {operator ?? 'Select operator...'}
          <ChevronsUpDown className="h-5 w-5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Search operator..." />
          <CommandList>
            <CommandEmpty>No operator found.</CommandEmpty>
            <CommandGroup>
              {availableOperators.map((op) => (
                <CommandItem
                  key={op.value}
                  keywords={[op.helperText]}
                  value={op.value}
                  onSelect={handleSelect}
                  className="flex flex-row justify-between"
                >
                  <div className="flex flex-row gap-2">
                    <span
                      className="shrink-0"
                      style={{ minWidth: `${maxOperatorLength}ch` }}
                    >
                      {op.value}
                    </span>
                    <span className="text-muted-foreground">
                      {op.helperText}
                    </span>
                  </div>
                  <Check
                    className={cn(
                      'ml-auto',
                      op.value === operator ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
