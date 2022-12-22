import ControlledSwitch from '@/components/common/ControlledSwitch';
import Text from '@/ui/v2/Text';
import PermissionSettingsSection from './PermissionSettingsSection';

export default function BackendOnlySection() {
  return (
    <PermissionSettingsSection title="Backend only">
      <Text variant="subtitle1">
        When enabled, this mutation is accessible only via &apos;trusted
        backends&apos;.
      </Text>

      <ControlledSwitch
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
