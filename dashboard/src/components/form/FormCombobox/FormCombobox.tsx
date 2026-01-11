import getTransformedFieldProps, {
  type Transformer,
} from '@/components/form/utils/getTransformedFieldProps';
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
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  Children,
  type ForwardedRef,
  type PropsWithChildren,
  type ReactNode,
  cloneElement,
  forwardRef,
  isValidElement,
  useState,
} from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { mergeRefs } from 'react-merge-refs';

const comboboxTriggerClasses =
  'aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500';

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
  helperText?: string | null;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  showSelectedIcon?: boolean;
  transform?: Transformer;
}

function isComponentType(element: ReactNode, component: unknown) {
  return isValidElement(element) && element.type === component;
}

function findSelectedLabel(
  children: ReactNode,
  value: string,
): ReactNode | null {
  let selected: ReactNode | null = null;
  Children.forEach(children, (child) => {
    if (selected) {
      return;
    }

    if (!isValidElement(child)) {
      return;
    }

    if (isComponentType(child, CommandItem) && child.props.value === value) {
      selected = child.props.children;
      return;
    }

    if (isNotEmptyValue(child.props?.children)) {
      selected = findSelectedLabel(child.props.children, value);
    }
  });

  return selected;
}

function hasCommandGroup(children: ReactNode): boolean {
  let found = false;
  Children.forEach(children, (child) => {
    if (found) {
      return;
    }

    if (!isValidElement(child)) {
      return;
    }

    if (isComponentType(child, CommandGroup)) {
      found = true;
      return;
    }

    if (
      isNotEmptyValue(child.props?.children) &&
      hasCommandGroup(child.props.children)
    ) {
      found = true;
    }
  });

  return found;
}

function enhanceCommandItems({
  children,
  selectedValue,
  onSelect,
  showSelectedIcon,
}: {
  children: ReactNode;
  selectedValue: string;
  onSelect: (value: string) => void;
  showSelectedIcon: boolean;
}): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) {
      return child;
    }

    if (isComponentType(child, CommandItem)) {
      const originalOnSelect = child.props.onSelect as
        | ((value: string) => void)
        | undefined;

      const originalChildren = child.props.children as ReactNode;
      const itemValue = child.props.value as string | undefined;
      const isSelected =
        isNotEmptyValue(itemValue) && itemValue === selectedValue;

      return (
        <CommandItem
          {...child.props}
          onSelect={(value) => {
            onSelect(value);
            originalOnSelect?.(value);
          }}
        >
          <>
            {enhanceCommandItems({
              children: originalChildren,
              selectedValue,
              onSelect,
              showSelectedIcon: false,
            })}
            {showSelectedIcon && (
              <Check
                className={cn(
                  'ml-auto h-4 w-4',
                  isSelected ? 'opacity-100' : 'opacity-0',
                )}
              />
            )}
          </>
        </CommandItem>
      );
    }

    if (!isNotEmptyValue(child.props?.children)) {
      return child;
    }

    return cloneElement(child, {
      ...child.props,
      children: enhanceCommandItems({
        children: child.props.children,
        selectedValue,
        onSelect,
        showSelectedIcon,
      }),
    });
  });
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
    children,
    searchPlaceholder = 'Search...',
    emptyText = 'No results found.',
    showSelectedIcon = true,
    transform,
  }: PropsWithChildren<FormComboboxProps<TFieldValues, TName>>,
  ref?: ForwardedRef<HTMLButtonElement>,
) {
  const [open, setOpen] = useState(false);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const {
          ref: fieldRef,
          onChange,
          value,
        } = isNotEmptyValue(transform)
          ? getTransformedFieldProps(field, transform)
          : field;

        let fieldValue = '';
        if (isNotEmptyValue(value)) {
          fieldValue = typeof value === 'string' ? value : String(value);
        }

        const selectedLabel = isNotEmptyValue(fieldValue)
          ? findSelectedLabel(children, fieldValue)
          : null;

        const enhancedChildren = enhanceCommandItems({
          children,
          selectedValue: fieldValue,
          onSelect: (nextValue) => {
            onChange(nextValue);
            setOpen(false);
          },
          showSelectedIcon,
        });

        const wrapInGroup = !hasCommandGroup(children);

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
                      {wrapInGroup ? (
                        <CommandGroup>{enhancedChildren}</CommandGroup>
                      ) : (
                        enhancedChildren
                      )}
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
  props: PropsWithChildren<FormComboboxProps<TFieldValues, TName>> & {
    ref?: ForwardedRef<HTMLButtonElement>;
  },
) => ReturnType<typeof FormComboboxImpl>;

export default FormCombobox;
