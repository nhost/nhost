import {
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useId,
  useRef,
  useState,
} from 'react';
import { mergeRefs } from 'react-merge-refs';
import { Input, type InputProps } from '@/components/ui/v3/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/v3/input-group';
import { cn } from '@/lib/utils';

export interface InputSuggestion {
  /**
   * Human-readable label shown in the dropdown.
   */
  label: string;
  /**
   * Value committed to the input when the suggestion is picked.
   */
  value: string;
}

export interface InputWithSuggestionsProps
  extends Omit<InputProps, 'value' | 'onChange' | 'prefix'> {
  value: string;
  onChange: (value: string) => void;
  /**
   * Suggestions offered in the dropdown. Picking one commits its `value`.
   */
  suggestions: InputSuggestion[];
  /**
   * Filter the suggestions by the current input value. Defaults to `true`.
   */
  filterSuggestions?: boolean;
  /**
   * Node rendered at the right end of the input (e.g. an info tooltip).
   */
  endAdornment?: ReactNode;
  containerClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

/**
 * A text input whose typed value is authoritative, paired with a dropdown of
 * suggestions that fill the input when picked. Implements the ARIA combobox /
 * listbox keyboard pattern: focus stays on the input, arrow keys move the
 * active option via `aria-activedescendant`, Enter selects, Escape closes. The
 * list opens on focus, typing, or click, and closes when focus leaves the
 * component. The suggestion options are intentionally not in the tab order.
 */
function InputWithSuggestions({
  value,
  onChange,
  suggestions,
  filterSuggestions = true,
  endAdornment,
  disabled,
  onFocus,
  onBlur,
  className,
  containerClassName,
  ref,
  ...inputProps
}: InputWithSuggestionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  const normalizedSearch = value.toLowerCase();
  const filteredSuggestions =
    filterSuggestions && normalizedSearch !== ''
      ? suggestions.filter(
          ({ label, value: suggestionValue }) =>
            label.toLowerCase().includes(normalizedSearch) ||
            suggestionValue.toLowerCase().includes(normalizedSearch),
        )
      : suggestions;

  const shouldShowSuggestions =
    isOpen && !disabled && filteredSuggestions.length > 0;
  const activeOptionId =
    shouldShowSuggestions && activeIndex >= 0
      ? `${listboxId}-option-${activeIndex}`
      : undefined;

  function open() {
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function pickSuggestion(suggestionValue: string) {
    onChange(suggestionValue);
    close();
    // Note: keep focus on the input so typing/arrowing can continue and a
    // click or ArrowDown reopens the list.
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!shouldShowSuggestions) {
          open();
          return;
        }
        setActiveIndex((index) =>
          Math.min(index + 1, filteredSuggestions.length - 1),
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!shouldShowSuggestions) {
          open();
          return;
        }
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case 'Enter':
        if (shouldShowSuggestions && activeIndex >= 0) {
          event.preventDefault();
          pickSuggestion(filteredSuggestions[activeIndex].value);
        }
        break;
      case 'Escape':
        if (isOpen) {
          event.preventDefault();
          close();
        }
        break;
      default:
        break;
    }
  }

  const sharedInputProps = {
    ...inputProps,
    type: 'text',
    autoComplete: 'off',
    disabled,
    value,
    ref: mergeRefs([ref, inputRef]),
    className,
    role: 'combobox',
    'aria-expanded': shouldShowSuggestions,
    'aria-controls': listboxId,
    'aria-autocomplete': 'list' as const,
    'aria-activedescendant': activeOptionId,
    onKeyDown: handleKeyDown,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      open();
      setActiveIndex(-1);
      onChange(event.target.value);
    },
    onFocus: (event: FocusEvent<HTMLInputElement>) => {
      open();
      onFocus?.(event);
    },
    onBlur: (event: FocusEvent<HTMLInputElement>) => {
      onBlur?.(event);
      // Note: close only when focus leaves the whole component, so it stays
      // open while focus is anywhere inside (input or addon).
      if (!containerRef.current?.contains(event.relatedTarget)) {
        close();
      }
    },
    onClick: open,
  };

  return (
    <div ref={containerRef} className={cn('relative', containerClassName)}>
      {endAdornment ? (
        <InputGroup className="h-10 border-border bg-transparent dark:bg-transparent">
          <InputGroupInput {...sharedInputProps} />
          <InputGroupAddon align="inline-end">{endAdornment}</InputGroupAddon>
        </InputGroup>
      ) : (
        <Input {...sharedInputProps} wrapperClassName="w-full" />
      )}

      {shouldShowSuggestions && (
        <ul
          id={listboxId}
          className="absolute top-full right-0 left-0 z-20 mt-1 max-h-60 divide-y divide-border overflow-auto rounded-md border bg-popover text-popover-foreground text-sm shadow-md"
        >
          {filteredSuggestions.map((suggestion, index) => (
            <li key={suggestion.value}>
              <button
                type="button"
                id={`${listboxId}-option-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={index === activeIndex}
                className={cn(
                  'w-full cursor-pointer border-none bg-transparent px-3 py-2 text-left hover:bg-accent',
                  { 'bg-accent': index === activeIndex },
                )}
                // Note: keep focus on the input when picking with the mouse.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pickSuggestion(suggestion.value)}
              >
                <div className="font-medium">{suggestion.label}</div>
                {suggestion.value !== suggestion.label && (
                  <div className="text-muted-foreground text-xs">
                    {suggestion.value}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { InputWithSuggestions };
