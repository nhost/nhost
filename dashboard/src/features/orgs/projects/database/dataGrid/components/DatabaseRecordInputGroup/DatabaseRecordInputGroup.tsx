import { KeyRound } from 'lucide-react';
import { type ChangeEvent, useEffect, useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { FormTextarea } from '@/components/form/FormTextarea';
import { ReadOnlyToggle } from '@/components/presentational/ReadOnlyToggle';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { SelectItem } from '@/components/ui/v3/select';
import type { DataBrowserColumnMetadata } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser/dataBrowser';
import { getInputType } from '@/features/orgs/projects/database/dataGrid/utils/inputHelpers';
import {
  isDateType,
  isTimestampType,
  isTimeType,
} from '@/features/orgs/projects/database/dataGrid/utils/temporalTypeHelpers';
import { POSTGRES_DEFAULT_PLACEHOLDER } from '@/features/orgs/projects/database/dataGrid/utils/postgresDefaultPlaceholder';
import { cn } from '@/lib/utils';
import NullDefaultToggleField from './NullDefaultToggleField';
import TemporalRecordField from './TemporalRecordField';

export interface DatabaseRecordInputGroupProps {
  /**
   * List of columns for which input fields should be generated.
   */
  columns: DataBrowserColumnMetadata[];
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
  return {
    in(value: unknown) {
      if (value === true || value === 'true') {
        return 'true';
      }
      if (value === false || value === 'false') {
        return 'false';
      }
      if (value === 'default' || value === POSTGRES_DEFAULT_PLACEHOLDER) {
        return 'default';
      }
      if (value === null || value === 'null') {
        return isNullable ? 'null' : '';
      }
      return '';
    },
    out(value: unknown) {
      if (value === 'true') {
        return 'true';
      }
      if (value === 'false') {
        return 'false';
      }
      if (value === 'default') {
        return POSTGRES_DEFAULT_PLACEHOLDER;
      }
      if (value === 'null' || value === '') {
        return null;
      }
      return value;
    },
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

function getDefaultPlaceholder(
  defaultValue: string | null | undefined,
  isIdentity?: boolean,
) {
  if (isIdentity) {
    return 'Automatically generated as identity';
  }

  if (!defaultValue) {
    return undefined;
  }

  if (!Number.isNaN(parseInt(defaultValue, 10))) {
    return defaultValue;
  }

  const display = defaultValue.replace(/\([^)]*\)/g, '()');
  return `Automatically generated value: ${display}`;
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
      <div className="space-y-4 sm:space-y-0">
        {columns.map((column, index) => {
          const {
            id: columnId,
            specificType,
            baseType,
            isArray,
            displayType,
            defaultValue,
            isPrimary,
            isNullable,
            isIdentity,
            comment,
          } = column;

          const hasDefault = !!(defaultValue || isIdentity);

          const isMultiline =
            isArray ||
            baseType === 'text' ||
            baseType === 'bpchar' ||
            baseType === 'character' ||
            baseType === 'character varying' ||
            baseType === 'json' ||
            baseType === 'jsonb';

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
                {displayType}
              </InlineCode>
            </span>
          );

          if (!isArray && baseType === 'boolean') {
            return (
              <FormSelect
                key={columnId}
                inline
                name={columnId!}
                control={control}
                label={inputLabel}
                placeholder="Select an option"
                helperText={comment}
                transform={getBooleanValueTransformer(!!isNullable)}
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

                {hasDefault && (
                  <SelectItem value="default">
                    <span className="text-muted-foreground">Default</span>
                  </SelectItem>
                )}
              </FormSelect>
            );
          }

          const isTemporalPicker =
            !isArray &&
            (isTimestampType(baseType) ||
              isDateType(baseType) ||
              isTimeType(baseType));

          if (isTemporalPicker) {
            return (
              <TemporalRecordField
                key={columnId}
                inline
                name={columnId!}
                control={control}
                label={inputLabel}
                baseType={baseType}
                isNullable={!!isNullable}
                hasDefault={hasDefault}
                placeholder={getDefaultPlaceholder(defaultValue, isIdentity)}
                helperText={comment}
              />
            );
          }

          if (isNullable && hasDefault) {
            return (
              <NullDefaultToggleField
                ref={getRef(index)}
                key={columnId}
                inline
                name={columnId!}
                control={control}
                label={inputLabel}
                placeholder={getDefaultPlaceholder(defaultValue, isIdentity)}
                helperText={comment}
                multiline={isMultiline}
                className={cn({ 'focus-visible:ring-0': isMultiline })}
                type={getInputType(baseType)}
              />
            );
          }

          let fallbackPlaceholder: string | undefined;
          if (isArray) {
            fallbackPlaceholder = 'e.g. [1, 2, 3]';
          } else if (isNullable) {
            fallbackPlaceholder = 'NULL';
          }

          const placeholder =
            getDefaultPlaceholder(defaultValue, isIdentity) ??
            fallbackPlaceholder;
          const InputComponent = isMultiline ? FormTextarea : FormInput;
          return (
            <InputComponent
              ref={getRef(index)}
              key={columnId}
              inline
              name={columnId!}
              control={control}
              label={inputLabel}
              placeholder={placeholder}
              helperText={comment}
              transform={{
                in: convertNullToEmptyString,
                out: convertEmptyStringToNull,
              }}
              className={cn(
                { 'resize-y': isMultiline },
                'focus-visible:ring-0',
              )}
              type={getInputType(baseType)}
            />
          );
        })}
      </div>
    </section>
  );
}
