import { useFormContext, useWatch } from 'react-hook-form';
import { v4 as uuidv4 } from 'uuid';
import { PermissionSettingsSectionV3 as PermissionSettingsSection } from '@/components/common/PermissionSettingsSection';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { Label } from '@/components/ui/v3/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import {
  CustomCheckEditor,
  CustomCheckModeProvider,
  CustomCheckModeToggle,
} from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor';
import type { GroupNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import applyPreset from './applyPreset';
import PermissionPresetCombobox from './PermissionPresetCombobox';
import {
  type PermissionPreset,
  type RowCheckType,
  STORAGE_ACTION_LABELS,
  STORAGE_SCHEMA,
  STORAGE_TABLE,
  type StorageAction,
  type StoragePermissionEditorFormValues,
} from './types';

export interface StorageRowPermissionsSectionProps {
  role: string;
  storageAction: StorageAction;
}

export default function StorageRowPermissionsSection({
  role,
  storageAction,
}: StorageRowPermissionsSectionProps) {
  const { setValue, getValues, reset } =
    useFormContext<StoragePermissionEditorFormValues>();

  const rowCheckType = useWatch<
    StoragePermissionEditorFormValues,
    'rowCheckType'
  >({ name: 'rowCheckType' });
  const actionLabel = STORAGE_ACTION_LABELS[storageAction].toLowerCase();

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

  function handlePresetSelect(preset: PermissionPreset) {
    const currentFilter = getValues('filter') as GroupNode | null;
    const newFilter = applyPreset(currentFilter, preset);

    reset(
      { ...getValues(), rowCheckType: 'custom', filter: newFilter },
      { keepDefaultValues: true },
    );
  }

  return (
    <PermissionSettingsSection title={`File ${actionLabel} permissions`}>
      <CustomCheckModeProvider>
        <p className="text-sm+">
          Allow role <InlineCode className="!text-sm+">{role}</InlineCode> to{' '}
          <InlineCode className="!text-sm+">{actionLabel}</InlineCode> files:
        </p>

        <div className="flex items-center justify-between gap-4">
          <RadioGroup
            value={rowCheckType}
            className="flex gap-4"
            onValueChange={(value) =>
              handleCheckTypeChange(value as typeof rowCheckType)
            }
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="none" id="row-check-none" />
              <Label htmlFor="row-check-none" className="text-sm+">
                Without any checks
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="custom" id="row-check-custom" />
              <Label htmlFor="row-check-custom" className="text-sm+">
                With custom check
              </Label>
            </div>
          </RadioGroup>
          {rowCheckType === 'custom' && <CustomCheckModeToggle />}
        </div>

        <PermissionPresetCombobox onSelect={handlePresetSelect} />

        {rowCheckType === 'custom' && (
          <CustomCheckEditor
            name="filter"
            schema={STORAGE_SCHEMA}
            table={STORAGE_TABLE}
          />
        )}
      </CustomCheckModeProvider>
    </PermissionSettingsSection>
  );
}
