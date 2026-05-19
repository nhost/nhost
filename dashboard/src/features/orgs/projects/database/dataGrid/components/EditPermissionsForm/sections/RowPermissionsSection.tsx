import type { FocusEvent } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { v4 as uuidv4 } from 'uuid';
import { HighlightedText } from '@/components/presentational/HighlightedText';
import { Input } from '@/components/ui/v2/Input';
import { Radio } from '@/components/ui/v2/Radio';
import { RadioGroup } from '@/components/ui/v2/RadioGroup';
import { Text } from '@/components/ui/v2/Text';
import {
  CustomCheckEditor,
  CustomCheckModeProvider,
  CustomCheckModeToggle,
} from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor';
import type {
  RolePermissionEditorFormValues,
  RowCheckType,
} from '@/features/orgs/projects/database/dataGrid/components/EditPermissionsForm/RolePermissionEditorForm';
import type { DatabaseAction } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { GroupNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import PermissionSettingsSection from './PermissionSettingsSection';

export interface RowPermissionsSectionProps {
  role: string;
  action: DatabaseAction;
  schema: string;
  table: string;
}

export default function RowPermissionsSection({
  role,
  action,
  schema,
  table,
}: RowPermissionsSectionProps) {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext<RolePermissionEditorFormValues>();

  const rowCheckType = useWatch<RolePermissionEditorFormValues, 'rowCheckType'>(
    {
      name: 'rowCheckType',
    },
  );

  function handleCheckTypeChange(value: RowCheckType) {
    setValue('rowCheckType', value, { shouldDirty: true });

    if (value === 'none') {
      setValue('filter', {}, { shouldDirty: true });
    } else {
      const emptyCustomCheck: GroupNode = {
        type: 'group',
        id: uuidv4(),
        operator: '_implicit',
        children: [],
      };
      setValue('filter', emptyCustomCheck, { shouldDirty: true });
    }
  }

  return (
    <PermissionSettingsSection title={`Row ${action} permissions`}>
      <CustomCheckModeProvider>
        <Text>
          Allow role <HighlightedText>{role}</HighlightedText> to{' '}
          <HighlightedText>{action}</HighlightedText> rows:
        </Text>

        <div className="flex items-center justify-between gap-4">
          <RadioGroup
            value={rowCheckType}
            className="grid grid-flow-col justify-start gap-4"
            onChange={(_event, value) =>
              handleCheckTypeChange(value as typeof rowCheckType)
            }
          >
            <Radio value="none" label="Without any checks" />
            <Radio value="custom" label="With custom check" />
          </RadioGroup>
          {rowCheckType === 'custom' && <CustomCheckModeToggle />}
        </div>

        {rowCheckType === 'custom' && (
          <CustomCheckEditor name="filter" schema={schema} table={table} />
        )}
      </CustomCheckModeProvider>

      {action === 'select' && (
        <Input
          {...register('limit', {
            onBlur: (event: FocusEvent<HTMLInputElement>) => {
              if (!event.target.value) {
                setValue('limit', null);
              }
            },
          })}
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
