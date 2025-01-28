import { InlineCode } from '@/components/presentational/InlineCode';
import { ReadOnlyToggle } from '@/components/presentational/ReadOnlyToggle';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { KeyIcon } from '@/components/ui/v2/icons/KeyIcon';
import { Input } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { Text } from '@/components/ui/v2/Text';
import type { DataBrowserGridColumn } from '@/features/database/dataGrid/types/dataBrowser';
import { getInputType } from '@/features/database/dataGrid/utils/inputHelpers';
import { normalizeDefaultValue } from '@/features/database/dataGrid/utils/normalizeDefaultValue';
import { Controller, useFormContext } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';

export interface DatabaseRecordInputGroupProps extends BoxProps {
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
  ...props
}: DatabaseRecordInputGroupProps) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext();

  return (
    <Box component="section" className={twMerge('py-3', className)} {...props}>
      {title && (
        <Text variant="h2" className="mb-1.5 mt-3 text-sm+ font-bold">
          {title}
        </Text>
      )}

      {description && (
        <Text className="mb-3 text-xs" color="secondary">
          {description}
        </Text>
      )}

      <div>
        {columns.map(
          (
            {
              id: columnId,
              type,
              specificType,
              maxLength,
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
              specificType === 'varchar' ||
              specificType === 'json' ||
              specificType === 'jsonb';

            const placeholder = getPlaceholder(
              defaultValue,
              isIdentity,
              isNullable,
            );

            const InputLabel = (
              <span className="inline-grid grid-flow-col gap-1">
                <span className="inline-grid grid-flow-col items-center gap-1">
                  {isPrimary && <KeyIcon className="text-base text-inherit" />}

                  <span>{columnId}</span>
                </span>

                <InlineCode className="h-[18px]">
                  {specificType}
                  {maxLength ? `(${maxLength})` : null}
                </InlineCode>
              </span>
            );

            const commonFormControlProps = {
              label: InputLabel,
              error: Boolean(errors[columnId]),
              helperText:
                comment ||
                (typeof errors[columnId]?.message === 'string'
                  ? (errors[columnId]?.message as string)
                  : null),
              hideEmptyHelperText: true,
              fullWidth: true,
              className: 'py-3',
            };

            const commonLabelProps = {
              className: 'grid grid-flow-row justify-items-start gap-1',
            };

            if (type === 'boolean') {
              return (
                <Controller
                  name={columnId}
                  control={control}
                  key={columnId}
                  render={({ field }) => (
                    <Select
                      {...commonFormControlProps}
                      {...field}
                      onChange={(_event, value) => field.onChange(value)}
                      variant="inline"
                      id={columnId}
                      value={field.value || 'null'}
                      placeholder="Select an option"
                      className={twMerge(
                        !field.value && 'text-sm font-normal',
                        'py-3',
                      )}
                      autoFocus={index === 0 && autoFocusFirstInput}
                      slotProps={{ label: commonLabelProps }}
                    >
                      <Option value="true">
                        <ReadOnlyToggle checked />
                      </Option>

                      <Option value="false">
                        <ReadOnlyToggle checked={false} />
                      </Option>

                      {isNullable && (
                        <Option value="null">
                          <ReadOnlyToggle checked={null} />
                        </Option>
                      )}
                    </Select>
                  )}
                />
              );
            }

            return (
              <Input
                {...commonFormControlProps}
                {...register(columnId)}
                variant="inline"
                id={columnId}
                key={columnId}
                type={getInputType({ type, specificType })}
                placeholder={placeholder}
                multiline={isMultiline}
                rows={5}
                autoFocus={index === 0 && autoFocusFirstInput}
                slotProps={{
                  label: commonLabelProps,
                  inputRoot: { step: 1 },
                }}
              />
            );
          },
        )}
      </div>
    </Box>
  );
}
