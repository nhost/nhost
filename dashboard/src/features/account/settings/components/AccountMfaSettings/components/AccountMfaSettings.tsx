import { SettingsCardHeader } from '@/components/layout/SettingsCard';
import DisableMfaButton from '@/features/account/settings/components/AccountMfaSettings/components/DisableMfaButton/DisableMfaButton';
import EnableMfaButton from '@/features/account/settings/components/AccountMfaSettings/components/EnableMfaButton/EnableMfaButton';
import useMfaEnabled from '@/features/account/settings/components/AccountMfaSettings/hooks/useMfaEnabled';
import { AccountSettingsCard } from '@/features/account/settings/components/AccountSettingsCard';

function AccountMfaSettings() {
  const { isMfaEnabled } = useMfaEnabled();

  // The on/off status lives in the profile header, so the card is just a
  // description with the enable or disable button on the right.
  return (
    <AccountSettingsCard>
      <SettingsCardHeader
        className="sm:items-start"
        title={null}
        description="Add a second step when you sign in, using a code from an authenticator app."
        control={isMfaEnabled ? <DisableMfaButton /> : <EnableMfaButton />}
      />
    </AccountSettingsCard>
  );
}

export default AccountMfaSettings;
