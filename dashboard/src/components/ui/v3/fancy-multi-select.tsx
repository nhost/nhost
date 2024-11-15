'use client';

import { X } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/v3/badge';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/v3/command';
import { cn } from '@/lib/utils';
import { Command as CommandPrimitive } from 'cmdk';

type Option = Record<'value' | 'label', string>;

interface FancyMultiSelectProps {
  options?: Option[];
  creatable?: boolean;
  className?: string;
  onChange?: (selected: Option[]) => void;
}

export function FancyMultiSelect({
  options = [],
  creatable = false,
  className,
  onChange,
}: FancyMultiSelectProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Option[]>([]);
  const [inputValue, setInputValue] = React.useState('');

  const handleUnselect = React.useCallback((option: Option) => {
    setSelected((prev) => prev.filter((s) => s.value !== option.value));
  }, []);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const input = inputRef.current;
      if (input) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (input.value === '') {
            setSelected((prev) => {
              const newSelected = [...prev];
              newSelected.pop();
              return newSelected;
            });
          }
        }
        // This is not a default behaviour of the <input /> field
        if (e.key === 'Escape') {
          input.blur();
        }
      }
    },
    [],
  );

  const handleSelect = React.useCallback(
    (option: Option) => {
      setInputValue('');
      setSelected((prev) => {
        const newSelected = [...prev, option];
        onChange?.(newSelected);
        return newSelected;
      });
    },
    [onChange],
  );

  const selectables = React.useMemo(() => {
    const filtered = options.filter(
      (option) =>
        !selected.includes(option) &&
        option.label.toLowerCase().includes(inputValue.toLowerCase()),
    );

    if (creatable && inputValue && !filtered.length) {
      return [
        {
          value: inputValue.toLowerCase(),
          label: inputValue,
        },
      ];
    }

    return filtered;
  }, [options, selected, inputValue, creatable]);

  return (
    <Command
      onKeyDown={handleKeyDown}
      className="relative overflow-visible bg-transparent"
    >
      <div
        className={cn(
          'group rounded-md border border-input bg-background px-3 py-0 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          className,
        )}
      >
        <div className="flex flex-wrap items-center gap-1 py-0">
          {selected.map((option) => {
            return (
              <Badge
                className="h-7 overflow-x-hidden text-ellipsis whitespace-nowrap break-words text-[12px] font-normal"
                key={option.value}
                variant="outline"
              >
                {option.label}
                <button
                  className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUnselect(option);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={() => handleUnselect(option)}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </Badge>
            );
          })}
          {/* Avoid having the "Search" Icon */}
          <CommandPrimitive.Input
            ref={inputRef}
            value={inputValue}
            onValueChange={setInputValue}
            onBlur={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            placeholder="Select options..."
            className="flex-1 border-none bg-transparent text-sm outline-none !ring-0 !ring-offset-0 placeholder:text-sm placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="relative mt-2">
        <CommandList>
          {open && selectables.length > 0 ? (
            <div className="absolute top-0 z-10 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in">
              <CommandGroup className="h-full overflow-auto">
                {selectables.map((option) => {
                  return (
                    <CommandItem
                      key={option.value}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onSelect={() => handleSelect(option)}
                      className="cursor-pointer"
                    >
                      {creatable &&
                      !options.find((opt) => opt.value === option.value)
                        ? `Create "${option.label}"`
                        : option.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </div>
          ) : null}
        </CommandList>
      </div>
    </Command>
  );
}
