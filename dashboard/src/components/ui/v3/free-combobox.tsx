import { forwardRef, type ReactNode, useState } from 'react';
import { Combobox, type ComboboxOption } from '@/components/ui/v3/combobox';
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
  /**
   * Which custom action committed the value, when `customValueActions` is used.
   * `undefined` for option picks and for the single-action `customValueLabel`
   * path.
   */
  actionKey?: string;
}

/**
 * One "create custom value" row. Use `customValueActions` (instead of
 * `customValueLabel`) when a typed value can be committed in more than one way
 * — e.g. quote-as-text vs. raw SQL. The chosen `key` is reported back through
 * `onChange`'s `meta.actionKey`.
 */
export interface FreeComboboxCustomAction {
  key: string;
  label: (input: string) => ReactNode;
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
   * input. Defaults to the input prefixed with a plus icon. Ignored when
   * `customValueActions` is provided.
   */
  customValueLabel?: (input: string) => ReactNode;
  /**
   * Multiple "create custom value" rows, each committing the typed value a
   * different way. When provided, takes precedence over `customValueLabel`.
   */
  customValueActions?: FreeComboboxCustomAction[];
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
    { value, onChange, customValueLabel, customValueActions, ...comboboxProps },
    ref,
  ) {
    const [open, setOpen] = useState(false);

    const footerSlot = customValueActions ? (
      customValueActions.map((action) => (
        <CommandCreateItem
          key={action.key}
          value={`create-${action.key}`}
          onCreate={(input) => {
            onChange(input, { source: 'custom', actionKey: action.key });
            setOpen(false);
          }}
          label={action.label}
        />
      ))
    ) : (
      <CommandCreateItem
        onCreate={(input) => {
          onChange(input, { source: 'custom' });
          setOpen(false);
        }}
        label={customValueLabel}
      />
    );

    return (
      <Combobox
        {...comboboxProps}
        ref={ref}
        value={value}
        open={open}
        onOpenChange={setOpen}
        onChange={(next) => onChange(next, { source: 'option' })}
        footerSlot={footerSlot}
      />
    );
  },
);

export { FreeCombobox };
