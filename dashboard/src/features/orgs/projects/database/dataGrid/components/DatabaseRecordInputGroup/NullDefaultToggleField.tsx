import {
  type ChangeEvent,
  type ForwardedRef,
  forwardRef,
  type ReactNode,
} from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { mergeRefs } from 'react-merge-refs';
import {
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
} from '@/components/ui/v3/input-group';
import { POSTGRES_DEFAULT_PLACEHOLDER } from '@/features/orgs/projects/database/dataGrid/utils/postgresDefaultPlaceholder';
import { cn } from '@/lib/utils';

interface NullDefaultToggleFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label: ReactNode;
  placeholder?: string;
  helperText?: string | null;
  className?: string;
  inline?: boolean;
  type?: string;
  multiline?: boolean;
}

function InnerNullDefaultToggleField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  {
    control,
    name,
    label,
    placeholder,
    helperText,
    className,
    inline,
    type = 'text',
    multiline = false,
  }: NullDefaultToggleFieldProps<TFieldValues, TName>,
  ref: ForwardedRef<HTMLInputElement | HTMLTextAreaElement>,
) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const isNull = field.value === null;
        const isDefault = field.value === POSTGRES_DEFAULT_PLACEHOLDER;

        const displayValue = isNull || isDefault ? '' : (field.value ?? '');

        let inputPlaceholder: string | undefined;
        if (isNull) {
          inputPlaceholder = 'NULL';
        } else if (isDefault) {
          inputPlaceholder = placeholder ?? 'DEFAULT';
        }

        function handleTextChange(
          e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) {
          field.onChange(e.target.value);
        }

        function handleSetNull() {
          field.onChange(null);
        }

        function handleSetDefault() {
          field.onChange(POSTGRES_DEFAULT_PLACEHOLDER);
        }

        return (
          <FormItem
            className={cn({ 'flex w-full items-center gap-4 py-3': inline })}
          >
            <FormLabel
              htmlFor={name as string}
              className={cn({
                'mt-2 w-52 max-w-52 flex-shrink-0 self-start': inline,
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
              <InputGroup
                className={cn('bg-transparent dark:bg-transparent', {
                  'border-destructive': !!fieldState.error,
                })}
              >
                {multiline ? (
                  <InputGroupTextarea
                    id={name as string}
                    placeholder={inputPlaceholder}
                    value={displayValue as string}
                    onChange={handleTextChange}
                    ref={mergeRefs([
                      field.ref,
                      ref as ForwardedRef<HTMLTextAreaElement>,
                    ])}
                    className={cn('resize-none', className)}
                  />
                ) : (
                  <InputGroupInput
                    id={name as string}
                    type={type}
                    placeholder={inputPlaceholder}
                    value={displayValue as string}
                    onChange={handleTextChange}
                    ref={mergeRefs([
                      field.ref,
                      ref as ForwardedRef<HTMLInputElement>,
                    ])}
                    className={className}
                  />
                )}
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    onClick={handleSetNull}
                    aria-pressed={isNull}
                  >
                    NULL
                  </InputGroupButton>
                  <InputGroupButton
                    type="button"
                    onClick={handleSetDefault}
                    aria-pressed={isDefault}
                  >
                    DEFAULT
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
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

const NullDefaultToggleField = forwardRef(InnerNullDefaultToggleField) as <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  props: NullDefaultToggleFieldProps<TFieldValues, TName> & {
    ref?: ForwardedRef<HTMLInputElement | HTMLTextAreaElement>;
  },
) => ReturnType<typeof InnerNullDefaultToggleField>;

export default NullDefaultToggleField;
