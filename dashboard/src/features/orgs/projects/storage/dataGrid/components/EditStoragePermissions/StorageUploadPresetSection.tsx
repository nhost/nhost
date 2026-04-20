import { useFormContext } from 'react-hook-form';
import { PermissionSettingsSectionV3 as PermissionSettingsSection } from '@/components/common/PermissionSettingsSection';
import { FormSwitch } from '@/components/form/FormSwitch';
import { InlineCode } from '@/components/ui/v3/inline-code';
import type { StoragePermissionEditorFormValues } from './types';

export default function StorageUploadPresetSection() {
  const { control } = useFormContext<StoragePermissionEditorFormValues>();

  return (
    <PermissionSettingsSection title="Uploader identity">
      <p className="text-muted-foreground text-sm+">
        Automatically set the uploader identity when files are created or
        replaced.
      </p>

      <FormSwitch
        control={control}
        name="prefillUploadedByUserId"
        label={
          <>
            Prefill <InlineCode>uploaded_by_user_id</InlineCode> with{' '}
            <InlineCode>X-Hasura-User-Id</InlineCode>
          </>
        }
      />
    </PermissionSettingsSection>
  );
}
