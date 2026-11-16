import {
  SettingsCardFooter,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { Badge } from '@/components/ui/v3/badge';
import DisableMfaButton from '@/features/account/settings/components/AccountMfaSettings/components/DisableMfaButton/DisableMfaButton';
import EnableMfaButton from '@/features/account/settings/components/AccountMfaSettings/components/EnableMfaButton/EnableMfaButton';
import useMfaEnabled from '@/features/account/settings/components/AccountMfaSettings/hooks/useMfaEnabled';
import { AccountSettingsCard } from '@/features/account/settings/components/AccountSettingsCard';

function MFaEnabledBadge() {
  return (
    <Badge variant="outline" className="border-green-400 text-green-400">
      Enabled
    </Badge>
  );
}

function MFaDisabledBadge() {
  return (
    <Badge variant="outline" className="border-destructive text-destructive">
      Disabled
    </Badge>
  );
}

function AccountMfaSettings() {
  const { isMfaEnabled } = useMfaEnabled();

  return (
    <AccountSettingsCard>
      <SettingsCardHeader
        title={
          <h3 className="flex items-center font-semibold text-lg">
            <span className="mr-4">Multi-Factor Authentication</span>
            {isMfaEnabled ? <MFaEnabledBadge /> : <MFaDisabledBadge />}
          </h3>
        }
      />

      <SettingsCardFooter className="justify-start sm:justify-start">
        {isMfaEnabled ? <DisableMfaButton /> : <EnableMfaButton />}
      </SettingsCardFooter>
    </AccountSettingsCard>
  );
}

export default AccountMfaSettings;
