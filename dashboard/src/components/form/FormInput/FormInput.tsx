import getTransformedFieldProps, {
  type Transformer,
} from '@/components/form/utils/getTransformedFieldProps';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Input, type InputProps } from '@/components/ui/v3/input';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import { cn, isNotEmptyValue } from '@/lib/utils';
import {
  type ForwardedRef,
  forwardRef,
  type ReactNode,
  useRef,
  useState,
} from 'react';
import type {
  Control,
  FieldPath,
  FieldValues,
  PathValue,
} from 'react-hook-form';
import { mergeRefs } from 'react-merge-refs';

const inputClasses =
  '!bg-transparent aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500';

interface FormInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label: ReactNode;
  placeholder?: string;
  className?: string;
  containerClassName?: string;
  type?: string;
  inline?: boolean;
  helperText?: string | null;
  transform?: Transformer;
  transformValue?: (
    value: PathValue<TFieldValues, TName>,
  ) => PathValue<TFieldValues, TName>;
  disabled?: boolean;
  autoComplete?: InputProps['autoComplete'];
  infoTooltip?: string;
  suggestions?: Array<{ label: string; value: string }>;
}

function InnerFormInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  {
    control,
    name,
    label,
    placeholder,
    className = '',
    containerClassName = '',
    type = 'text',
    inline,
    helperText,
    disabled,
    autoComplete,
    infoTooltip,
    transform,
    suggestions,
  }: FormInputProps<TFieldValues, TName>,
  ref?: ForwardedRef<HTMLInputElement>,
) {
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const fieldProps = isNotEmptyValue(transform)
          ? getTransformedFieldProps(field, transform)
          : field;
        const suggestionsEnabled =
          isNotEmptyValue(suggestions) && suggestions.length > 0;
        const inputValue =
          typeof fieldProps.value === 'string'
            ? fieldProps.value
            : (fieldProps.value ?? '');

        let filteredSuggestions: Array<{ label: string; value: string }> = [];
        if (suggestionsEnabled) {
          const normalizedSearch = String(inputValue).toLowerCase();
          filteredSuggestions =
            normalizedSearch === ''
              ? suggestions
              : suggestions.filter(
                  ({ label: suggestionLabel, value: suggestionValue }) =>
                    suggestionLabel.toLowerCase().includes(normalizedSearch) ||
                    suggestionValue.toLowerCase().includes(normalizedSearch),
                );
        }
        const shouldShowSuggestions =
          suggestionsEnabled &&
          isSuggestionsOpen &&
          filteredSuggestions.length > 0;
        return (
          <FormItem
            className={cn(
              { 'flex w-full items-center gap-4 py-3': inline },
              containerClassName,
            )}
          >
            {infoTooltip ? (
              <div className="flex flex-row items-center gap-2">
                <FormLabel
                  className={cn({
                    'mt-2 w-52 max-w-52 flex-shrink-0 self-start': inline,
                  })}
                >
                  {label}
                </FormLabel>
                <InfoTooltip>{infoTooltip}</InfoTooltip>
              </div>
            ) : (
              <FormLabel
                className={cn({
                  'mt-2 w-52 max-w-52 flex-shrink-0 self-start': inline,
                })}
              >
                {label}
              </FormLabel>
            )}
            <div
              className={cn({
                'flex w-[calc(100%-13.5rem)] max-w-[calc(100%-13.5rem)] flex-col gap-2':
                  inline,
              })}
            >
              {suggestionsEnabled ? (
                <div className="relative">
                  <FormControl>
                    <Input
                      type={type}
                      placeholder={placeholder}
                      disabled={disabled}
                      autoComplete={autoComplete}
                      {...fieldProps}
                      onChange={(event) => {
                        setIsSuggestionsOpen(true);
                        fieldProps.onChange(event);
                      }}
                      onFocus={() => setIsSuggestionsOpen(true)}
                      onBlur={() => {
                        fieldProps.onBlur();
                        setTimeout(() => setIsSuggestionsOpen(false), 100);
                      }}
                      ref={mergeRefs([field.ref, ref, inputRef])}
                      className={cn(inputClasses, className)}
                      wrapperClassName={cn({ 'w-full': !inline })}
                    />
                  </FormControl>

                  {shouldShowSuggestions ? (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
                      <ul
                        role="listbox"
                        className="divide-y divide-border text-sm"
                        onMouseDown={(event) => event.preventDefault()}
                      >
                        {filteredSuggestions.map((option) => (
                          <li
                            key={option.value}
                            role="option"
                            tabIndex={-1}
                            aria-selected={option.value === String(inputValue)}
                            className="cursor-pointer px-3 py-2 hover:bg-accent"
                            onClick={() => {
                              fieldProps.onChange(option.value);
                              setIsSuggestionsOpen(false);
                              inputRef.current?.focus();
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                fieldProps.onChange(option.value);
                                setIsSuggestionsOpen(false);
                                inputRef.current?.focus();
                              }
                            }}
                          >
                            <div className="font-medium">{option.label}</div>
                            {option.value !== option.label ? (
                              <div className="text-xs text-muted-foreground">
                                {option.value}
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (
                <FormControl>
                  <Input
                    type={type}
                    placeholder={placeholder}
                    disabled={disabled}
                    autoComplete={autoComplete}
                    {...fieldProps}
                    ref={mergeRefs([field.ref, ref])}
                    className={cn(inputClasses, className)}
                    wrapperClassName={cn({ 'w-full': !inline })}
                  />
                </FormControl>
              )}
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

const FormInput = forwardRef(InnerFormInput) as <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  props: FormInputProps<TFieldValues, TName> & {
    ref?: ForwardedRef<HTMLInputElement>;
  },
) => ReturnType<typeof InnerFormInput>;

export default FormInput;
