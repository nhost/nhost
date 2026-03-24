import type { FocusEvent, ReactNode } from 'react';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { v4 as uuidv4 } from 'uuid';
import { HighlightedText } from '@/components/presentational/HighlightedText';
import { Input } from '@/components/ui/v2/Input';
import { Radio } from '@/components/ui/v2/Radio';
import { RadioGroup } from '@/components/ui/v2/RadioGroup';
import { Text } from '@/components/ui/v2/Text';
import { CustomCheckEditor } from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor';
import type { RolePermissionEditorFormValues } from '@/features/orgs/projects/database/dataGrid/components/EditPermissionsForm/RolePermissionEditorForm';
import type { DatabaseAction } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { GroupNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import { isNotEmptyValue } from '@/lib/utils';
import PermissionSettingsSection from './PermissionSettingsSection';

export interface RowPermissionsSectionProps {
  /**
   * Determines whether or not the section is disabled.
   */
  disabled?: boolean;
  /**
   * The role that is being edited.
   */
  role: string;
  /**
   * The action that is being edited.
   */
  action: DatabaseAction;
  /**
   * The schema that is being edited.
   */
  schema: string;
  /**
   * The table that is being edited.
   */
  table: string;
}

export default function RowPermissionsSection({
  role,
  action,
  schema,
  table,
  disabled,
}: RowPermissionsSectionProps) {
  const {
    register,
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext<RolePermissionEditorFormValues>();
  const { filter } = getValues();

  const defaultRowCheckType = isNotEmptyValue(filter?.children)
    ? 'custom'
    : 'none';

  const [rowCheckType, setRowCheckType] = useState<'none' | 'custom'>(
    defaultRowCheckType,
  );

  function handleCheckTypeChange(value: typeof rowCheckType) {
    setRowCheckType(value);

    if (value === 'none') {
      setValue('filter', {});
    } else {
      const emptyCustomCheck: GroupNode = {
        type: 'group',
        id: uuidv4(),
        operator: '_implicit',
        children: [],
      };
      setValue('filter', emptyCustomCheck);
    }
  }

  return (
    <PermissionSettingsSection title={`Row ${action} permissions`}>
      <Text>
        Allow role <HighlightedText>{role}</HighlightedText> to{' '}
        <HighlightedText>{action}</HighlightedText> rows:
      </Text>

      <RadioGroup
        value={rowCheckType}
        className="grid grid-flow-col justify-start gap-4"
        onChange={(_event, value) =>
          handleCheckTypeChange(value as typeof rowCheckType)
        }
      >
        <Radio value="none" label="Without any checks" disabled={disabled} />
        <Radio value="custom" label="With custom check" disabled={disabled} />
      </RadioGroup>

      {errors?.filter?.root?.message || errors?.filter?.message ? (
        <Text
          variant="subtitle2"
          className="font-normal"
          sx={{ color: (theme) => `${theme.palette.error.main} !important` }}
        >
          {(errors.filter.root?.message ?? errors.filter.message) as ReactNode}
        </Text>
      ) : null}

      {rowCheckType === 'custom' && (
        <CustomCheckEditor
          name="filter"
          schema={schema}
          table={table}
          disabled={disabled}
        />
      )}

      {action === 'select' && (
        <Input
          {...register('limit', {
            onBlur: (event: FocusEvent<HTMLInputElement>) => {
              if (!event.target.value) {
                setValue('limit', null);
              }
            },
          })}
          disabled={disabled}
          id="limit"
          type="number"
          label="Limit number of rows"
          slotProps={{
            input: { className: 'max-w-xs w-full' },
            inputRoot: { min: 0 },
          }}
          helperText={
            errors?.limit?.message ||
            'Set limit on number of rows fetched per request.'
          }
          error={Boolean(errors?.limit)}
        />
      )}
    </PermissionSettingsSection>
  );
}
