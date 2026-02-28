import { Badge } from '@/components/ui/v3/badge';
import useMfaEnabled from '@/features/account/settings/components/AccountMfaSettings/hooks/useMfaEnabled';
import DisableMfaButton from './DisableMfaButton/DisableMfaButton';
import EnableMfaButton from './EnableMfaButton/EnableMfaButton';

function MFaEnabledBadge() {
  return (
    <Badge variant="outline" className="border-green-400 text-green-400">
      Enabled
    </Badge>
  );
}

function MFaDisabledBadge() {
  return (
    <Badge
      variant="outline"
      className="text- border-destructive text-destructive"
    >
      Disabled
    </Badge>
  );
}

function AccountMfaSettings() {
  const { isMfaEnabled } = useMfaEnabled();
  return (
    <div className="rounded-lg border border-[#EAEDF0] bg-white font-['Inter_var'] dark:border-[#2F363D] dark:bg-paper">
      <div className="flex w-full flex-col items-start gap-6 p-4">
        <div className="flex w-full items-center justify-between">
          <h3 className="flex items-center font-semibold text-[1.125rem] leading-[1.75]">
            <span className="mr-4">Multi-Factor Authentication </span>
            {isMfaEnabled ? <MFaEnabledBadge /> : <MFaDisabledBadge />}
          </h3>
        </div>
      </div>
      <div className="flex w-full items-center border-[#EAEDF0] border-t px-4 py-2 dark:border-[#2F363D]">
        {isMfaEnabled ? <DisableMfaButton /> : <EnableMfaButton />}
      </div>
    </div>
  );
}

export default AccountMfaSettings;
