import { useFormContext } from 'react-hook-form';
import { PermissionSettingsSection } from '@/components/common/PermissionSettingsSection';
import { FormSwitch } from '@/components/form/FormSwitch';

import type { StoragePermissionEditorFormValues } from './types';

export interface StorageUploadPresetSectionProps {
  disabled?: boolean;
}

export default function StorageUploadPresetSection({
  disabled,
}: StorageUploadPresetSectionProps) {
  const { control } = useFormContext<StoragePermissionEditorFormValues>();

  return (
    <PermissionSettingsSection title="Upload preset">
      <p className="text-muted-foreground text-sm">
        Automatically set the uploader identity when files are created or
        replaced.
      </p>

      <FormSwitch
        control={control}
        name="prefillUploadedByUserId"
        disabled={disabled}
        label={
          <>
            Prefill <code>uploaded_by_user_id</code> with{' '}
            <code>X-Hasura-User-Id</code>
          </>
        }
      />
    </PermissionSettingsSection>
  );
}
