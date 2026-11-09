import { SettingsCardHeader } from '@/components/layout/SettingsCard';
import { Badge } from '@/components/ui/v3/badge';
import DisableMfaButton from '@/features/account/settings/components/AccountMfaSettings/components/DisableMfaButton/DisableMfaButton';
import EnableMfaButton from '@/features/account/settings/components/AccountMfaSettings/components/EnableMfaButton/EnableMfaButton';
import useMfaEnabled from '@/features/account/settings/components/AccountMfaSettings/hooks/useMfaEnabled';
import { AccountSettingsCard } from '@/features/account/settings/components/AccountSettingsCard';

function AccountMfaSettings() {
  const { isMfaEnabled } = useMfaEnabled();

  // The status as a tag next to the name, the same as the GitHub row in
  // Connected accounts, so the card itself shows whether it is on.
  return (
    <AccountSettingsCard>
      <SettingsCardHeader
        className="sm:items-start"
        title={
          <span className="flex items-center gap-2 font-medium">
            Authenticator app
            <Badge
              variant="outline"
              className={
                isMfaEnabled
                  ? 'border-success/40 text-success'
                  : 'text-muted-foreground'
              }
            >
              {isMfaEnabled ? 'On' : 'Off'}
            </Badge>
          </span>
        }
        description="Add a second step when you sign in, using a code from an authenticator app."
        control={isMfaEnabled ? <DisableMfaButton /> : <EnableMfaButton />}
      />
    </AccountSettingsCard>
  );
}

export default AccountMfaSettings;
