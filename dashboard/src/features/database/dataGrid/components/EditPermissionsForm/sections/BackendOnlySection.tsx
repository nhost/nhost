import { ControlledSwitch } from '@/components/form/ControlledSwitch';
import { Text } from '@/components/ui/v2/Text';
import PermissionSettingsSection from './PermissionSettingsSection';

export interface BackendOnlySectionProps {
  /**
   * Determines whether or not the section is disabled.
   */
  disabled?: boolean;
}

export default function BackendOnlySection({
  disabled,
}: BackendOnlySectionProps) {
  return (
    <PermissionSettingsSection title="Backend only">
      <Text variant="subtitle1">
        When enabled, this mutation is accessible only via &apos;trusted
        backends&apos;.
      </Text>

      <ControlledSwitch
        disabled={disabled}
        name="backendOnly"
        label={
          <Text variant="subtitle1" component="span">
            Allow from backends only
          </Text>
        }
      />
    </PermissionSettingsSection>
  );
}
