import { useFormContext, useWatch } from 'react-hook-form';
import { v4 as uuidv4 } from 'uuid';
import { FormInput } from '@/components/form/FormInput';
import { HighlightedText } from '@/components/presentational/HighlightedText';
import { Label } from '@/components/ui/v3/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
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
  const { control, setValue } =
    useFormContext<RolePermissionEditorFormValues>();

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
        <p>
          Allow role <HighlightedText>{role}</HighlightedText> to{' '}
          <HighlightedText>{action}</HighlightedText> rows:
        </p>

        <div className="flex items-center justify-between gap-4">
          <RadioGroup
            value={rowCheckType}
            className="grid grid-flow-col justify-start gap-4"
            onValueChange={(value) =>
              handleCheckTypeChange(value as RowCheckType)
            }
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem
                id="rowCheck-none"
                value="none"
                className="cursor-pointer"
              />
              <Label htmlFor="rowCheck-none" className="cursor-pointer">
                Without any checks
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem
                id="rowCheck-custom"
                value="custom"
                className="cursor-pointer"
              />
              <Label htmlFor="rowCheck-custom" className="cursor-pointer">
                With custom check
              </Label>
            </div>
          </RadioGroup>
          {rowCheckType === 'custom' && <CustomCheckModeToggle />}
        </div>

        {rowCheckType === 'custom' && (
          <CustomCheckEditor name="filter" schema={schema} table={table} />
        )}
      </CustomCheckModeProvider>

      {action === 'select' && (
        <FormInput
          control={control}
          name="limit"
          type="number"
          label="Limit number of rows"
          className="max-w-xs"
          helperText="Set limit on number of rows fetched per request."
          onBlur={(event) => {
            if (!event.target.value) {
              setValue('limit', null);
            }
          }}
        />
      )}
    </PermissionSettingsSection>
  );
}
