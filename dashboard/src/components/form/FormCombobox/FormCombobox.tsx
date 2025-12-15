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
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';

export type FormComboboxOption = {
  label: string;
  value: string;
};

export interface FormComboboxProps<
  TFieldValues extends FieldValues = FieldValues,
> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder: string;
  options: FormComboboxOption[];
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
}

/**
 * Form combobox field built on top of `Popover` + `Command`, designed to work with `react-hook-form`.
 *
 * Note: this is currently optimized for string values (matches the extracted use-case from relationships).
 */
export default function FormCombobox<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  options,
  disabled,
  searchPlaceholder = 'Search...',
  emptyText = 'No results found.',
}: FormComboboxProps<TFieldValues>) {
  const [open, setOpen] = useState(false);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        // We expect the value to be a string (or empty). If not, render it as-is.
        const fieldValue =
          typeof field.value === 'string' ? field.value : String(field.value);

        const selectedOption = options.find(
          (option) => option.value === fieldValue,
        );

        return (
          <FormItem className="flex flex-col gap-1">
            <FormLabel>{label}</FormLabel>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className={cn(
                      'w-full justify-between',
                      !selectedOption && 'text-muted-foreground',
                    )}
                    disabled={disabled}
                  >
                    {selectedOption?.label ?? fieldValue ?? placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput
                    placeholder={searchPlaceholder}
                    className="h-9"
                  />
                  <CommandList>
                    <CommandEmpty>{emptyText}</CommandEmpty>
                    <CommandGroup>
                      {options.map((option) => (
                        <CommandItem
                          key={option.value}
                          value={option.value}
                          onSelect={(currentValue) => {
                            field.onChange(currentValue);
                            setOpen(false);
                          }}
                        >
                          {option.label}
                          <Check
                            className={cn(
                              'ml-auto h-4 w-4',
                              fieldValue === option.value
                                ? 'opacity-100'
                                : 'opacity-0',
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
