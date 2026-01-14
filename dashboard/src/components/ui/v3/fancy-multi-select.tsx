'use client';

import { X } from 'lucide-react';

import { Badge } from '@/components/ui/v3/badge';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/v3/command';
import { cn } from '@/lib/utils';
import { Command as CommandPrimitive } from 'cmdk';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

export type Option = Record<'value' | 'label', string>;

interface FancyMultiSelectProps {
  value?: Option[];
  options?: Option[];
  creatable?: boolean;
  className?: string;
  onChange?: (selected: Option[]) => void;
}

export function FancyMultiSelect({
  value = [],
  options = [],
  creatable = false,
  className,
  onChange,
}: FancyMultiSelectProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Option[]>(value);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    setSelected(value);
  }, [value]);

  const handleUnselect = useCallback((option: Option) => {
    setSelected((prev) => prev.filter((s) => s.value !== option.value));
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
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
  }, []);

  function handleSelect(option: Option) {
    setInputValue('');
    const newSelected = [...selected, option];
    setSelected(newSelected);
    onChange?.(newSelected);
  }

  const selectables = useMemo(() => {
    const filtered = options.filter(
      (option) =>
        !selected.map((s) => s.value).includes(option.value) &&
        option.label.toLowerCase().includes(inputValue.toLowerCase()),
    );

    if (creatable && inputValue) {
      return [
        ...filtered,
        {
          value: inputValue,
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
          'group flex min-h-10 flex-1 rounded-md border bg-background px-4 py-0 text-sm ring-offset-background hover:bg-accent',
          className,
        )}
      >
        <div className="flex flex-1 flex-wrap items-center gap-1 overflow-x-hidden py-1">
          {selected.map((option) => {
            return (
              <Badge
                className="h-7 overflow-x-hidden font-normal text-[12px]"
                key={option.value}
                variant="outline"
              >
                <span
                  className="overflow-x-hidden text-ellipsis whitespace-nowrap break-words font-medium"
                  data-testid={`badge-${option.label}`}
                >
                  {option.label}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${option.label}`}
                  className="ml-1 rounded-full outline-none"
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
            className="!ring-0 !ring-offset-0 flex flex-1 border-none bg-transparent px-0 py-1 font-medium text-sm outline-none placeholder:text-muted-foreground placeholder:text-sm group-hover:text-accent-foreground"
          />
        </div>
      </div>
      <div className="relative">
        <CommandList>
          {open && selectables.length > 0 ? (
            <div className="absolute top-2 z-10 w-full animate-in rounded-md border bg-popover text-popover-foreground shadow-md outline-none">
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
