import {
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { AccountSettingsCard } from '@/features/account/settings/components/AccountSettingsCard';
import AddSecurityKeyButton from '@/features/account/settings/components/SecurityKeysSettings/components/AddSecurityKeyButton';
import SecurityKeyList from '@/features/account/settings/components/SecurityKeysSettings/components/SecurityKeyList';

function SecurityKeysSettings() {
  return (
    <AccountSettingsCard>
      <SettingsCardHeader title="Manage your security keys" />

      <SettingsCardContent>
        <SecurityKeyList />
      </SettingsCardContent>

      <SettingsCardFooter className="justify-start sm:justify-start">
        <AddSecurityKeyButton />
      </SettingsCardFooter>
    </AccountSettingsCard>
  );
}

export default SecurityKeysSettings;
