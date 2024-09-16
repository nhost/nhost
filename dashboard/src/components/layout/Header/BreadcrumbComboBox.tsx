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
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';

type BreadCrumbComboBoxItem<T> = {
  label: string | ReactNode;
  value: string | T;
};

interface BreadCrumbComboBoxProps<T> {
  selectedValue?: T;
  options: BreadCrumbComboBoxItem<T>[];
  renderItem?: (item: T) => ReactNode;
  onChange?: (item: BreadCrumbComboBoxItem<T>) => void;
  filter?: (value: string, search: string) => number;
}

export default function BreadCrumbComboBox<T>({
  selectedValue,
  options,
  renderItem,
  onChange,
  filter,
}: BreadCrumbComboBoxProps<T>) {
  const [open, setOpen] = useState(false);
  const [selectedItem, setSelectedItem] =
    useState<BreadCrumbComboBoxItem<T> | null>(
      options.find((option) => option.value === selectedValue) || null,
    );

  const renderSelectedItem = (item: BreadCrumbComboBoxItem<T>) => {
    if (typeof item.value === 'string') {
      return typeof item.label === 'string' ? (
        <span className="text-foreground">{item.label}</span>
      ) : (
        item.label
      );
    }
    return renderItem ? renderItem(item.value) : null;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-foreground"
        >
          <div className="flex flex-row items-center justify-center gap-1">
            {selectedItem && renderSelectedItem(selectedItem)}
            <ChevronsUpDown className="h-5 w-5 text-muted-foreground" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" side="bottom" align="start">
        <Command filter={filter}>
          <CommandInput placeholder="Search..." autoFocus />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option, index) => (
                <CommandItem
                  key={`${
                    typeof option.value === 'string' ? option.value : index
                  }`}
                  value={
                    typeof option.value === 'string' ? option.value : `${index}`
                  }
                  onSelect={() => {
                    setSelectedItem(option);
                    setOpen(false);
                    onChange?.(option);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedItem?.value === option.value
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  {typeof option.value === 'string'
                    ? option.label
                    : renderItem && renderItem(option.value)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
