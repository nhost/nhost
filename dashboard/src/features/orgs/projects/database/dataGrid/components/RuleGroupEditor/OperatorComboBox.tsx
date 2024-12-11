import { Check, ChevronsUpDown } from 'lucide-react';

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
import type { HasuraOperator } from '@/features/database/dataGrid/types/dataBrowser';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

const commonOperators: {
  value: HasuraOperator;
  label?: string;
  helperText?: string;
}[] = [
  { value: '_eq', helperText: 'equal' },
  { value: '_neq', helperText: 'not equal' },
  { value: '_in', helperText: 'in (array)' },
  { value: '_nin', helperText: 'not in (array)' },
  { value: '_gt', helperText: 'greater than' },
  { value: '_lt', helperText: 'lower than' },
  { value: '_gte', helperText: 'greater than or equal' },
  { value: '_lte', helperText: 'lower than or equal' },
  { value: '_ceq', helperText: 'equal to column' },
  { value: '_cne', helperText: 'not equal to column' },
  { value: '_cgt', helperText: 'greater than column' },
  { value: '_clt', helperText: 'lower than column' },
  { value: '_cgte', helperText: 'greater than or equal to column' },
  { value: '_clte', helperText: 'lower than or equal to column' },
  { value: '_is_null', helperText: 'null' },
];

const textSpecificOperators: typeof commonOperators = [
  { value: '_like', helperText: 'like' },
  { value: '_nlike', helperText: 'not like' },
  { value: '_ilike', helperText: 'like (case-insensitive)' },
  { value: '_nilike', helperText: 'not like (case-insensitive)' },
  { value: '_similar', helperText: 'similar' },
  { value: '_nsimilar', helperText: 'not similar' },
  { value: '_regex', helperText: 'matches regex' },
  { value: '_nregex', helperText: `doesn't match regex` },
  { value: '_iregex', helperText: 'matches case-insensitive regex' },
  { value: '_niregex', helperText: `doesn't match case-insensitive regex` },
];

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
  const { watch, setValue } = useFormContext();

  const operator = watch(`${name}.operator`);

  const availableOperators = [
    ...commonOperators,
    ...(selectedColumnType === 'text' ? textSpecificOperators : []),
  ];

  const handleSelect = (value: string) => {
    if (['_in', '_nin'].includes(value)) {
      setValue(`${name}.value`, [], { shouldDirty: true });
    }

    setValue(`${name}.operator`, value, { shouldDirty: true });
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
      <PopoverContent side="bottom" align="start" className="p-0">
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
                    <span className="min-w-[9ch]">{op.value}</span>
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
