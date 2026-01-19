import { type ReactNode, useRef, useState } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { mergeRefs } from 'react-merge-refs';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
import { cn } from '@/lib/utils';

const inputClasses =
  '!bg-transparent aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500';

const cronSuggestions = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Hourly', value: '0 * * * *' },
  { label: 'Daily at midnight (UTC)', value: '0 0 * * *' },
  { label: 'Weekdays at 9am (UTC)', value: '0 9 * * 1-5' },
];

interface CronScheduleInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label: ReactNode;
  placeholder?: string;
  className?: string;
  containerClassName?: string;
}

export default function CronScheduleInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  placeholder,
  className = '',
  containerClassName = '',
}: CronScheduleInputProps<TFieldValues, TName>) {
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const inputValue =
          typeof field.value === 'string' ? field.value : (field.value ?? '');

        const normalizedSearch = String(inputValue).toLowerCase();
        const filteredSuggestions =
          normalizedSearch === ''
            ? cronSuggestions
            : cronSuggestions.filter(
                ({ label: suggestionLabel, value: suggestionValue }) =>
                  suggestionLabel.toLowerCase().includes(normalizedSearch) ||
                  suggestionValue.toLowerCase().includes(normalizedSearch),
              );

        const shouldShowSuggestions =
          isSuggestionsOpen && filteredSuggestions.length > 0;

        return (
          <FormItem className={cn(containerClassName)}>
            <FormLabel>{label}</FormLabel>
            <div className="relative">
              <FormControl>
                <Input
                  type="text"
                  placeholder={placeholder}
                  autoComplete="off"
                  {...field}
                  onChange={(event) => {
                    setIsSuggestionsOpen(true);
                    field.onChange(event);
                  }}
                  onFocus={() => setIsSuggestionsOpen(true)}
                  onBlur={() => {
                    field.onBlur();
                    setTimeout(() => setIsSuggestionsOpen(false), 100);
                  }}
                  ref={mergeRefs([field.ref, inputRef])}
                  className={cn(inputClasses, className)}
                />
              </FormControl>

              {shouldShowSuggestions ? (
                <div className="absolute top-full right-0 left-0 z-20 mt-1 max-h-60 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
                  <ul
                    className="divide-y divide-border text-sm"
                    onMouseDown={(event) => event.preventDefault()}
                  >
                    {filteredSuggestions.map((option) => (
                      <li key={option.value}>
                        <button
                          type="button"
                          role="option"
                          tabIndex={-1}
                          aria-selected={option.value === String(inputValue)}
                          className="w-full cursor-pointer border-none bg-transparent px-3 py-2 text-left hover:bg-accent"
                          onClick={() => {
                            field.onChange(option.value);
                            setIsSuggestionsOpen(false);
                            inputRef.current?.focus();
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              field.onChange(option.value);
                              setIsSuggestionsOpen(false);
                              inputRef.current?.focus();
                            }
                          }}
                        >
                          <div className="font-medium">{option.label}</div>
                          {option.value !== option.label ? (
                            <div className="text-muted-foreground text-xs">
                              {option.value}
                            </div>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
