import { ChevronsUpDown } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
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

export interface FormAutocompleteOption {
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

/**
 * Where a committed value came from. Lets callers distinguish a value
 * picked from the option list from one typed as a custom value, even
 * when the strings are identical.
 */
export type FormAutocompleteChangeSource = 'option' | 'custom';

export interface FormAutocompleteChangeMeta {
  source: FormAutocompleteChangeSource;
}

export interface FormAutocompleteCoreProps {
  value: string | null;
  onChange: (value: string | null, meta?: FormAutocompleteChangeMeta) => void;
  onBlur?: VoidFunction;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: ReactNode;
  className?: string;
  disabled?: boolean;
  options: FormAutocompleteOption[];
  /**
   * Custom search scorer. Receives the item's `value`, the current search
   * string, and the item's `keywords` (which always include the option's
   * label). Return `0` to hide the item, `>0` to show (and rank). When
   * omitted, cmdk's default fuzzy scorer is used.
   */
  filter?: (value: string, search: string, keywords?: string[]) => number;
  allowCustomValue?: boolean;
  customValueLabel?: (input: string) => ReactNode;
  /**
   * Optional override for the trigger content. When provided, replaces the
   * auto-computed label (from option match or raw value). Use when the trigger
   * needs custom rendering that depends on caller-side state — e.g. styling a
   * free-typed value differently from a picked option.
   */
  triggerLabel?: ReactNode;
  popoverContentClassName?: string;
  'data-testid'?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
}

export default function FormAutocompleteCore({
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
  allowCustomValue,
  customValueLabel,
  triggerLabel,
  popoverContentClassName,
  'data-testid': dataTestId,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
}: FormAutocompleteCoreProps) {
  const [open, setOpen] = useState(false);

  const groupedOptions = useMemo(() => {
    const groups = new Map<string, FormAutocompleteOption[]>();
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

  const commit = (next: string, source: FormAutocompleteChangeSource) => {
    onChange(next, { source });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          data-testid={dataTestId}
          aria-label={ariaLabel}
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
                    onSelect={() => commit(option.value, 'option')}
                  >
                    {option.render ?? option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {!!allowCustomValue && (
              <CommandCreateItem
                onCreate={(input) => commit(input, 'custom')}
                label={customValueLabel}
              />
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
