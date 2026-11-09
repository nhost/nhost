import { SettingsCardHeader } from '@/components/layout/SettingsCard';
import { AccountSettingsCard } from '@/features/account/settings/components/AccountSettingsCard';
import AddSecurityKeyButton from '@/features/account/settings/components/SecurityKeysSettings/components/AddSecurityKeyButton';
import SecurityKeyList from '@/features/account/settings/components/SecurityKeysSettings/components/SecurityKeyList';

function SecurityKeysSettings() {
  return (
    <AccountSettingsCard>
      <SettingsCardHeader
        className="sm:items-start"
        title={null}
        description="Use a security key or a passkey on your device to sign in to Nhost."
        control={<AddSecurityKeyButton />}
      />

      <SecurityKeyList />
    </AccountSettingsCard>
  );
}

export default SecurityKeysSettings;
