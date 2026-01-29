import { Check, ChevronsUpDown } from 'lucide-react';
import type { ForwardedRef, ReactNode } from 'react';
import { forwardRef, useState } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { mergeRefs } from 'react-merge-refs';
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
  FormDescription,
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
import { cn, isNotEmptyValue } from '@/lib/utils';

const comboboxTriggerClasses =
  'aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500';

export interface FormComboboxOption {
  value: string;
  label: ReactNode;
}

interface FormComboboxProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label: ReactNode;
  placeholder?: string;
  className?: string;
  containerClassName?: string;
  inline?: boolean;
  helperText?: ReactNode | null;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  options: FormComboboxOption[];
  'data-testid'?: string;
}

function FormComboboxImpl<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  {
    control,
    name,
    label,
    placeholder,
    className,
    containerClassName,
    inline,
    helperText,
    disabled,
    options,
    searchPlaceholder = 'Search...',
    emptyText = 'No results found.',
    'data-testid': dataTestId,
  }: FormComboboxProps<TFieldValues, TName>,
  ref?: ForwardedRef<HTMLButtonElement>,
) {
  const [open, setOpen] = useState(false);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const { ref: fieldRef, onChange, value } = field;

        let fieldValue = '';
        if (isNotEmptyValue(value)) {
          fieldValue = typeof value === 'string' ? value : String(value);
        }

        const selectedOption = options.find((opt) => opt.value === fieldValue);
        const selectedLabel = selectedOption?.label ?? fieldValue;

        return (
          <FormItem
            className={cn(
              { 'flex w-full items-center gap-4 py-3': inline },
              containerClassName,
            )}
          >
            <FormLabel
              className={cn({
                'w-52 max-w-52 flex-shrink-0': inline,
                'mt-2 self-start': inline && !!helperText,
              })}
            >
              {label}
            </FormLabel>
            <div
              className={cn({
                'flex w-[calc(100%-13.5rem)] max-w-[calc(100%-13.5rem)] flex-col gap-2':
                  inline,
              })}
            >
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className={cn(
                        comboboxTriggerClasses,
                        'w-full justify-between',
                        !selectedLabel &&
                          !isNotEmptyValue(fieldValue) &&
                          'text-muted-foreground',
                        className,
                      )}
                      disabled={disabled}
                      ref={mergeRefs([fieldRef, ref])}
                      data-testid={dataTestId}
                    >
                      {selectedLabel ||
                        (isNotEmptyValue(fieldValue)
                          ? fieldValue
                          : placeholder)}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput
                      placeholder={searchPlaceholder}
                      className="h-9"
                      disabled={disabled}
                    />
                    <CommandList>
                      <CommandEmpty>{emptyText}</CommandEmpty>
                      <CommandGroup>
                        {options.map((option) => (
                          <CommandItem
                            key={option.value}
                            value={option.value}
                            onSelect={() => {
                              onChange(option.value);
                              setOpen(false);
                            }}
                          >
                            {option.label}
                            <Check
                              className={cn(
                                'ml-auto',
                                option.value === fieldValue
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
              {!!helperText && (
                <FormDescription className="break-all px-[1px]">
                  {helperText}
                </FormDescription>
              )}
              <FormMessage />
            </div>
          </FormItem>
        );
      }}
    />
  );
}

const FormCombobox = forwardRef(FormComboboxImpl) as <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  props: FormComboboxProps<TFieldValues, TName> & {
    ref?: ForwardedRef<HTMLButtonElement>;
  },
) => ReturnType<typeof FormComboboxImpl>;

export default FormCombobox;
