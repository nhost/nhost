import { ShieldCheck } from 'lucide-react';
import DisableMfaButton from '@/features/account/settings/components/AccountMfaSettings/components/DisableMfaButton/DisableMfaButton';
import EnableMfaButton from '@/features/account/settings/components/AccountMfaSettings/components/EnableMfaButton/EnableMfaButton';
import useMfaEnabled from '@/features/account/settings/components/AccountMfaSettings/hooks/useMfaEnabled';
import { AccountSettingsTile } from '@/features/account/settings/components/AccountSettingsTile';

function AccountMfaSettings() {
  const { isMfaEnabled } = useMfaEnabled();

  return (
    <AccountSettingsTile
      icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
      title="Authenticator app"
      active={isMfaEnabled}
      status={isMfaEnabled ? 'On' : 'Off'}
      description="Add a second step when you sign in, using a code from an authenticator app."
      action={isMfaEnabled ? <DisableMfaButton /> : <EnableMfaButton />}
    />
  );
}

export default AccountMfaSettings;
