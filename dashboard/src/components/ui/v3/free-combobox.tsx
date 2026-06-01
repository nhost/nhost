import { forwardRef, type ReactNode, useState } from 'react';
import Combobox, { type ComboboxOption } from '@/components/ui/v3/combobox';
import { CommandCreateItem } from '@/components/ui/v3/command';

export type { ComboboxOption };

/**
 * Where a committed value came from. Lets callers distinguish a value
 * picked from the option list from one typed as a custom value, even
 * when the strings are identical.
 */
export type FreeComboboxChangeSource = 'option' | 'custom';

export interface FreeComboboxChangeMeta {
  source: FreeComboboxChangeSource;
}

export interface FreeComboboxProps {
  value: string | null;
  onChange: (value: string, meta: FreeComboboxChangeMeta) => void;
  onBlur?: VoidFunction;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: ReactNode;
  className?: string;
  disabled?: boolean;
  options: ComboboxOption[];
  filter?: (value: string, search: string, keywords?: string[]) => number;
  triggerLabel?: ReactNode;
  /**
   * Label for the "create custom value" row. Receives the current search
   * input. Defaults to the input prefixed with a plus icon.
   */
  customValueLabel?: (input: string) => ReactNode;
  popoverContentClassName?: string;
  'data-testid'?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
}

/**
 * Open-set combobox: accepts values typed by the user in addition to the
 * provided `options`. Wraps `Combobox`, supplying the create row through its
 * `footerSlot`. The `onChange` `meta.source` tells callers whether the
 * committed value was picked from the list (`'option'`) or typed (`'custom'`).
 */
const FreeCombobox = forwardRef<HTMLButtonElement, FreeComboboxProps>(
  function FreeComboboxComponent(
    { value, onChange, customValueLabel, ...comboboxProps },
    ref,
  ) {
    const [open, setOpen] = useState(false);

    return (
      <Combobox
        {...comboboxProps}
        ref={ref}
        value={value}
        open={open}
        onOpenChange={setOpen}
        onChange={(next) => onChange(next, { source: 'option' })}
        footerSlot={
          <CommandCreateItem
            onCreate={(input) => {
              onChange(input, { source: 'custom' });
              setOpen(false);
            }}
            label={customValueLabel}
          />
        }
      />
    );
  },
);

export default FreeCombobox;
