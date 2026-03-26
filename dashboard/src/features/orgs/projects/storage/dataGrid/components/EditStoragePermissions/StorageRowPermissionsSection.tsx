import type { ReactNode } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { v4 as uuidv4 } from 'uuid';
import { PermissionSettingsSection } from '@/components/common/PermissionSettingsSection';
import { Label } from '@/components/ui/v3/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import { CustomCheckEditor } from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor';
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
  disabled?: boolean;
  role: string;
  storageAction: StorageAction;
}

export default function StorageRowPermissionsSection({
  role,
  storageAction,
  disabled,
}: StorageRowPermissionsSectionProps) {
  const {
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useFormContext<StoragePermissionEditorFormValues>();

  const rowCheckType = useWatch<StoragePermissionEditorFormValues, 'rowCheckType'>({ name: 'rowCheckType' });
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
      <p className="text-sm">
        Allow role <strong>{role}</strong> to <strong>{actionLabel}</strong>{' '}
        files:
      </p>

      <RadioGroup
        value={rowCheckType}
        className="flex gap-4"
        onValueChange={(value) =>
          handleCheckTypeChange(value as typeof rowCheckType)
        }
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem
            value="none"
            id="row-check-none"
            disabled={disabled}
          />
          <Label htmlFor="row-check-none">Without any checks</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem
            value="custom"
            id="row-check-custom"
            disabled={disabled}
          />
          <Label htmlFor="row-check-custom">With custom check</Label>
        </div>
      </RadioGroup>

      {!disabled && (
        <PermissionPresetCombobox
          onSelect={handlePresetSelect}
          disabled={disabled}
        />
      )}

      {errors?.filter?.root?.message || errors?.filter?.message ? (
        <p className="text-destructive text-sm">
          {(errors.filter.root?.message ?? errors.filter.message) as ReactNode}
        </p>
      ) : null}

      {rowCheckType === 'custom' && (
        <CustomCheckEditor
          name="filter"
          schema={STORAGE_SCHEMA}
          table={STORAGE_TABLE}
          disabled={disabled}
        />
      )}
    </PermissionSettingsSection>
  );
}
