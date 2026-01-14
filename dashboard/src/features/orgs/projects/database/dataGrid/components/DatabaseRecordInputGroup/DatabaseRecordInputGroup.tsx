import { KeyRound } from 'lucide-react';
import { type ChangeEvent, useEffect, useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { FormTextarea } from '@/components/form/FormTextarea';
import { ReadOnlyToggle } from '@/components/presentational/ReadOnlyToggle';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { SelectItem } from '@/components/ui/v3/select';
import type { DataBrowserGridColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getInputType } from '@/features/orgs/projects/database/dataGrid/utils/inputHelpers';
import { normalizeDefaultValue } from '@/features/orgs/projects/database/dataGrid/utils/normalizeDefaultValue';
import { cn } from '@/lib/utils';

export interface DatabaseRecordInputGroupProps {
  /**
   * List of columns for which input fields should be generated.
   */
  columns: DataBrowserGridColumn[];
  /**
   * Title of the input group.
   */
  title?: string;
  /**
   * Description of the input group.
   */
  description?: string;
  /**
   * Determines whether the first input field should be focused.
   */
  autoFocusFirstInput?: boolean;
  className?: string;
}

function getBooleanValueTransformer(isNullable: boolean) {
  return function transformBooleanValue(value: string | null) {
    let convertedValue = value;

    if (convertedValue === null) {
      convertedValue = isNullable ? 'null' : '';
    } else if (convertedValue === 'null' || convertedValue === '') {
      convertedValue = null;
    }

    return convertedValue;
  };
}

function convertNullToEmptyString(value: string | null) {
  return value === null ? '' : value;
}

function convertEmptyStringToNull(
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
) {
  return event.target.value === '' ? null : event.target.value;
}

function getPlaceholder(
  defaultValue?: string,
  isIdentity?: boolean,
  isNullable?: boolean,
) {
  if (isIdentity) {
    return 'Automatically generated as identity';
  }

  if (!defaultValue && isNullable) {
    return 'NULL';
  }

  if (!defaultValue) {
    return '';
  }

  if (!Number.isNaN(parseInt(defaultValue, 10))) {
    return defaultValue;
  }

  const { normalizedDefaultValue, custom } = normalizeDefaultValue(
    defaultValue,
    { removeArgs: true },
  );

  if (custom) {
    return normalizedDefaultValue;
  }

  return `Automatically generated value: ${normalizedDefaultValue}`;
}

export default function DatabaseRecordInputGroup({
  title,
  description,
  columns,
  autoFocusFirstInput,
  className,
}: DatabaseRecordInputGroupProps) {
  const { control } = useFormContext();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  function getRef(index: number) {
    return (element: HTMLTextAreaElement | HTMLInputElement | null) => {
      if (element && index === 0 && autoFocusFirstInput) {
        inputRef.current = element;
      }
    };
  }

  return (
    <section className={cn('box py-3 font-display', className)}>
      {title && <h2 className="mt-3 mb-1.5 font-bold text-sm+">{title}</h2>}
      {description && (
        <p className="mb-3 text-secondary text-xs">{description}</p>
      )}
      <div>
        {columns.map(
          (
            {
              id: columnId,
              type,
              specificType,
              defaultValue,
              isPrimary,
              isNullable,
              isIdentity,
              comment,
            },
            index,
          ) => {
            const isMultiline =
              specificType === 'text' ||
              specificType === 'bpchar' ||
              specificType?.includes('character varying') ||
              specificType === 'json' ||
              specificType === 'jsonb';

            const placeholder = getPlaceholder(
              defaultValue,
              isIdentity,
              isNullable,
            );

            const inputLabel = (
              <span className="inline-grid grid-flow-col gap-1">
                <span className="inline-grid grid-flow-col items-center gap-1 break-all">
                  {isPrimary && (
                    <KeyRound className="text-base text-inherit" size={13} />
                  )}
                  <span>{columnId}</span>
                </span>

                <InlineCode
                  className="h-[1.125rem] overflow-hidden whitespace-nowrap leading-[1.125rem]"
                  title={specificType}
                >
                  {specificType}
                </InlineCode>
              </span>
            );

            if (type === 'boolean') {
              return (
                <FormSelect
                  key={columnId}
                  inline
                  name={columnId}
                  control={control}
                  label={inputLabel}
                  placeholder="Select an option"
                  helperText={comment}
                  transform={{
                    in: getBooleanValueTransformer(!!isNullable),
                    out: getBooleanValueTransformer(!!isNullable),
                  }}
                >
                  <SelectItem value="true">
                    <ReadOnlyToggle checked />
                  </SelectItem>

                  <SelectItem value="false">
                    <ReadOnlyToggle checked={false} />
                  </SelectItem>

                  {isNullable && (
                    <SelectItem value="null">
                      <ReadOnlyToggle checked={null} />
                    </SelectItem>
                  )}
                </FormSelect>
              );
            }

            const InputComponent = isMultiline ? FormTextarea : FormInput;
            return (
              <InputComponent
                ref={getRef(index)}
                key={columnId}
                inline
                name={columnId}
                control={control}
                label={inputLabel}
                placeholder={placeholder}
                helperText={comment}
                transform={{
                  in: convertNullToEmptyString,
                  out: convertEmptyStringToNull,
                }}
                className={cn(
                  { 'resize-none': isMultiline },
                  'focus-visible:ring-0',
                )}
                type={getInputType({ type, specificType })}
              />
            );
          },
        )}
      </div>
    </section>
  );
}
