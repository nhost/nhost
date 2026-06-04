import { Check, ChevronsUpDown } from 'lucide-react';
import { forwardRef, type ReactNode, useMemo, useState } from 'react';
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

export interface ComboboxOption {
  value: string;
  /**
   * Human-readable name. Shown on the trigger when selected and used
   * as a search keyword so users can type the friendly name to find
   * the option (e.g. typing "boolean" matches an option whose value is "bool").
   */
  label: string;
  /**
   * Optional rich rendering for the dropdown row. Defaults to `label`.
   */
  render?: ReactNode;
  group?: string;
}

export interface ComboboxProps {
  value: string | null;
  onChange: (value: string) => void;
  onBlur?: VoidFunction;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: ReactNode;
  className?: string;
  disabled?: boolean;
  options: ComboboxOption[];
  /**
   * Custom search scorer. Receives the item's `value`, the current search
   * string, and the item's `keywords` (which always include the option's
   * label). Return `0` to hide the item, `>0` to show (and rank). When
   * omitted, cmdk's default fuzzy scorer is used.
   */
  filter?: (value: string, search: string, keywords?: string[]) => number;
  /**
   * Optional override for the trigger content. When provided, replaces the
   * auto-computed label (from option match or raw value). Use when the trigger
   * needs custom rendering that depends on caller-side state — e.g. styling a
   * free-typed value differently from a picked option.
   */
  triggerLabel?: ReactNode;
  /**
   * Extra content rendered at the bottom of the command list, inside the same
   * `Command`. `FreeCombobox` uses this to inject its "create custom value"
   * row without duplicating the popover/command scaffolding.
   */
  footerSlot?: ReactNode;
  /**
   * Controlled open state. When omitted, the popover manages its own open
   * state. `FreeCombobox` controls it so the create row can close the popover
   * after committing.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  popoverContentClassName?: string;
  id?: string;
  'data-testid'?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

const Combobox = forwardRef<HTMLButtonElement, ComboboxProps>(
  function ComboboxComponent(
    {
      value,
      onChange,
      onBlur,
      placeholder,
      searchPlaceholder = 'Search...',
      emptyText = 'No results found.',
      className,
      disabled,
      options,
      filter,
      triggerLabel,
      footerSlot,
      open,
      onOpenChange,
      popoverContentClassName,
      id,
      'data-testid': dataTestId,
      'aria-label': ariaLabel,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
    },
    ref,
  ) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpenControlled = open !== undefined;
    const isOpen = isOpenControlled ? open : internalOpen;
    const setOpen = (next: boolean) => {
      if (!isOpenControlled) {
        setInternalOpen(next);
      }
      onOpenChange?.(next);
    };

    const groupedOptions = useMemo(() => {
      const groups = new Map<string, ComboboxOption[]>();
      for (const option of options) {
        const key = option.group ?? '';
        const existing = groups.get(key);
        if (existing) {
          existing.push(option);
        } else {
          groups.set(key, [option]);
        }
      }
      return Array.from(groups.entries());
    }, [options]);

    const selected = options.find((option) => option.value === value);
    const displayLabel: ReactNode =
      triggerLabel ??
      selected?.label ??
      (typeof value === 'string' && value.length > 0 ? value : null);

    return (
      <Popover open={isOpen} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            data-testid={dataTestId}
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            aria-invalid={ariaInvalid}
            className={cn(
              'w-full justify-between font-normal',
              !displayLabel && 'text-muted-foreground',
              className,
            )}
            onBlur={onBlur}
          >
            <span className="truncate">{displayLabel ?? placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn(
            'max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0',
            popoverContentClassName,
          )}
        >
          <Command filter={filter}>
            <CommandInput
              placeholder={searchPlaceholder}
              className="h-9"
              disabled={disabled}
            />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              {groupedOptions.map(([heading, items]) => (
                <CommandGroup
                  key={heading || '__default__'}
                  heading={heading || undefined}
                >
                  {items.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      keywords={[option.label]}
                      onSelect={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                    >
                      {option.render ?? option.label}
                      <Check
                        className={cn(
                          'ml-auto size-4',
                          option.value === value ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
              {footerSlot}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
);

export { Combobox };
