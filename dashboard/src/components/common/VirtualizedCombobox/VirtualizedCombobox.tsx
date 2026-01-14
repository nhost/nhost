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
import { useVirtualizer } from '@tanstack/react-virtual';
import { Check, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';

type Option = {
  value: string;
  label: string;
  key?: string;
};

interface VirtualizedCommandProps<O extends Option> {
  height?: string;
  options: O[];
  placeholder: string;
  selectedOption: string;
  onSelectOption?: (option: O) => void;
  emptyText?: string;
}

function VirtualizedCommand<O extends Option>({
  height,
  options,
  placeholder,
  selectedOption,
  onSelectOption,
  emptyText,
}: VirtualizedCommandProps<O>) {
  const [filteredOptions, setFilteredOptions] = React.useState<O[]>(options);
  const [focusedIndex, setFocusedIndex] = React.useState(0);
  const [isKeyboardNavActive, setIsKeyboardNavActive] = React.useState(false);

  const parentRef = React.useRef(null);

  const virtualizer = useVirtualizer({
    count: filteredOptions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
  });

  const virtualOptions = virtualizer.getVirtualItems();

  const scrollToIndex = (index: number) => {
    virtualizer.scrollToIndex(index, {
      align: 'center',
    });
  };

  const handleSearch = (search: string) => {
    setIsKeyboardNavActive(false);
    setFilteredOptions(
      options.filter((option) =>
        option.label.toLowerCase().includes(search.toLowerCase()),
      ),
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        setIsKeyboardNavActive(true);
        setFocusedIndex((prev) => {
          const newIndex =
            prev === -1 ? 0 : Math.min(prev + 1, filteredOptions.length - 1);
          scrollToIndex(newIndex);
          return newIndex;
        });
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        setIsKeyboardNavActive(true);
        setFocusedIndex((prev) => {
          const newIndex =
            prev === -1 ? filteredOptions.length - 1 : Math.max(prev - 1, 0);
          scrollToIndex(newIndex);
          return newIndex;
        });
        break;
      }
      case 'Enter': {
        event.preventDefault();
        if (filteredOptions[focusedIndex]) {
          onSelectOption?.(filteredOptions[focusedIndex]);
        }
        break;
      }
      default:
        break;
    }
  };

  return (
    <Command
      shouldFilter={false}
      onKeyDown={handleKeyDown}
      value={selectedOption}
    >
      <CommandInput onValueChange={handleSearch} placeholder={placeholder} />
      <CommandList
        ref={parentRef}
        style={{
          height,
          width: '100%',
          overflow: 'auto',
        }}
        onMouseDown={() => setIsKeyboardNavActive(false)}
        onMouseMove={() => setIsKeyboardNavActive(false)}
      >
        <CommandEmpty>{emptyText || 'No item found.'}</CommandEmpty>
        <CommandGroup>
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualOptions.map((virtualOption) => (
              <CommandItem
                key={
                  filteredOptions[virtualOption.index].key ??
                  filteredOptions[virtualOption.index].value
                }
                className={cn(
                  'absolute top-0 left-0 w-full bg-transparent',
                  focusedIndex === virtualOption.index &&
                    'bg-accent text-accent-foreground',
                  isKeyboardNavActive &&
                    focusedIndex !== virtualOption.index &&
                    'aria-selected:bg-transparent aria-selected:text-primary',
                )}
                style={{
                  height: `${virtualOption.size}px`,
                  transform: `translateY(${virtualOption.start}px)`,
                }}
                value={filteredOptions[virtualOption.index].value}
                onMouseEnter={() =>
                  !isKeyboardNavActive && setFocusedIndex(virtualOption.index)
                }
                onMouseLeave={() => !isKeyboardNavActive && setFocusedIndex(-1)}
                onSelect={() => onSelectOption?.(filteredOptions[focusedIndex])}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    selectedOption ===
                      filteredOptions[virtualOption.index].value
                      ? 'opacity-100'
                      : 'opacity-0',
                  )}
                />
                {filteredOptions[virtualOption.index].label}
              </CommandItem>
            ))}
          </div>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

interface VirtualizedComboboxProps<O extends Option> {
  options: O[];
  searchPlaceholder?: string;
  width?: string;
  height?: string;
  button?: React.JSX.Element;
  onSelectOption: (option: O) => void;
  selectedOption: string;
  align?: 'start' | 'center' | 'end';
  side?: 'right' | 'top' | 'bottom' | 'left';
}

function VirtualizedCombobox<O extends Option>({
  options,
  searchPlaceholder = 'Search items...',
  width,
  height,
  button,
  onSelectOption,
  selectedOption,
  align = 'start',
  side,
}: VirtualizedComboboxProps<O>) {
  const [open, setOpen] = React.useState(false);
  const defaultButton = (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className="justify-between"
      style={{
        width,
      }}
    >
      {selectedOption
        ? options.find((option) => option.value === selectedOption)!.value
        : searchPlaceholder}
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{button || defaultButton}</PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={{ width }}
        align={align}
        side={side}
      >
        <VirtualizedCommand
          height={height}
          options={options}
          placeholder={searchPlaceholder}
          selectedOption={selectedOption}
          onSelectOption={(currentValue) => {
            onSelectOption(currentValue);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export default VirtualizedCombobox;
