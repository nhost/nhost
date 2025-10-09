import { FormInput } from '@/components/form/FormInput';
import FormSelect from '@/components/form/FormSelect/FormSelect';
import { FormTextarea } from '@/components/form/FormTextarea';
import { ReadOnlyToggle } from '@/components/presentational/ReadOnlyToggle';
import { KeyIcon } from '@/components/ui/v2/icons/KeyIcon';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { SelectItem } from '@/components/ui/v3/select';
import type { DataBrowserGridColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getInputType } from '@/features/orgs/projects/database/dataGrid/utils/inputHelpers';
import { normalizeDefaultValue } from '@/features/orgs/projects/database/dataGrid/utils/normalizeDefaultValue';
import { cn } from '@/lib/utils';
import { useFormContext } from 'react-hook-form';

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

  return (
    <section className={cn('box py-3 font-display', className)}>
      {title && <h2 className="mb-1.5 mt-3 text-sm+ font-bold">{title}</h2>}
      {description && (
        <p className="mb-3 text-xs text-secondary">{description}</p>
      )}
      <div>
        {columns.map(
          ({
            id: columnId,
            type,
            specificType,
            maxLength,
            defaultValue,
            isPrimary,
            isNullable,
            isIdentity,
            comment,
          }) => {
            const isMultiline =
              specificType === 'text' ||
              specificType === 'bpchar' ||
              specificType === 'varchar' ||
              specificType === 'json' ||
              specificType === 'jsonb';

            const placeholder = getPlaceholder(
              defaultValue,
              isIdentity,
              isNullable,
            );

            const inputLabel = (
              <span className="inline-grid grid-flow-col gap-1">
                <span className="inline-grid grid-flow-col items-center gap-1">
                  {isPrimary && <KeyIcon className="text-base text-inherit" />}

                  <span>{columnId}</span>
                </span>

                <InlineCode
                  className="h-[1.125rem] overflow-hidden whitespace-nowrap leading-[1.125rem]"
                  style={{ textOverflow: 'clip' }}
                  title={specificType}
                >
                  {specificType}
                  {maxLength ? `(${maxLength})` : null}
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
                  placeholder={placeholder}
                  helperText={comment}
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
                key={columnId}
                inline
                name={columnId}
                control={control}
                label={inputLabel}
                placeholder={placeholder}
                helperText={comment}
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
