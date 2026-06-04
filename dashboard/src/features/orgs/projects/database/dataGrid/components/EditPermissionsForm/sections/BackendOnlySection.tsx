import { useFormContext } from 'react-hook-form';
import { FormSwitch } from '@/components/form/FormSwitch';
import type { RolePermissionEditorFormValues } from '@/features/orgs/projects/database/dataGrid/components/EditPermissionsForm/RolePermissionEditorForm';
import PermissionSettingsSection from './PermissionSettingsSection';

export default function BackendOnlySection() {
  const { control } = useFormContext<RolePermissionEditorFormValues>();

  return (
    <PermissionSettingsSection title="Backend only">
      <p className="text-muted-foreground">
        When enabled, this mutation is accessible only via &apos;trusted
        backends&apos;.
      </p>

      <FormSwitch
        control={control}
        name="backendOnly"
        inline
        label={
          <span className="text-muted-foreground">
            Allow from backends only
          </span>
        }
      />
    </PermissionSettingsSection>
  );
}
