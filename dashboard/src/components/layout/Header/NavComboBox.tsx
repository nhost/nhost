import { Button } from '@/components/ui/v3/button';
import { cn } from '@/lib/utils';

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

import { Check, ChevronsUpDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';

type Option = {
  value: string;
  label: string;
  icon?: ReactNode;
};

interface NavComboBoxProps {
  value: Option;
  options: Option[];
  onSelect?: (option: Option) => Promise<any>;
}

export default function NavComboBox({
  value,
  options,
  onSelect,
}: NavComboBoxProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 text-foreground"
        >
          {value ? (
            <div className="flex flex-row items-center justify-center gap-2">
              {value.icon}
              {value.label}
            </div>
          ) : (
            <>Select page</>
          )}
          <ChevronsUpDown className="h-5 w-5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" side="bottom" align="start">
        <Command>
          <CommandInput placeholder="Change status..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={(_value) => {
                    const selectedOption =
                      options.find((o) => o.label === _value) || null;
                    setOpen(false);
                    onSelect?.(selectedOption);
                  }}
                  className="flex flex-row gap-2"
                >
                  <Check
                    className={cn(
                      'h-4 w-4',
                      value?.value === option.value
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  {option.icon}
                  <span>{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
