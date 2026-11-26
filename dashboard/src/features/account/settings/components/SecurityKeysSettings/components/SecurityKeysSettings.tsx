import { SettingsCardHeader } from '@/components/layout/SettingsCard';
import { AccountSettingsCard } from '@/features/account/settings/components/AccountSettingsCard';
import AddSecurityKeyButton from '@/features/account/settings/components/SecurityKeysSettings/components/AddSecurityKeyButton';
import SecurityKeyList from '@/features/account/settings/components/SecurityKeysSettings/components/SecurityKeyList';

function SecurityKeysSettings() {
  return (
    <AccountSettingsCard>
      <SettingsCardHeader
        className="sm:items-start"
        title="Passkeys"
        description="Sign in to Nhost with Touch ID, Face ID, your phone or a hardware key, no password needed."
        control={<AddSecurityKeyButton />}
      />

      <SecurityKeyList />
    </AccountSettingsCard>
  );
}

export default SecurityKeysSettings;
