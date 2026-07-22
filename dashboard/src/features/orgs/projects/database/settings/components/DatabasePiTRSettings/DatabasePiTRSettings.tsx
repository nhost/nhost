import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { Switch } from '@/components/ui/v3/switch';
import { TextLink } from '@/components/ui/v3/text-link';
import { InfoAlert } from '@/features/orgs/components/InfoAlert';
import { useDatabasePiTRSettings } from '@/features/orgs/hooks/useDatabasePiTRSettings/';
import { useUpdateDatabasePiTRConfig } from '@/features/orgs/hooks/useUpdateDatabasePiTRConfig';
import { UpgradeNotification } from '@/features/orgs/projects/database/settings/components/UpgradeNotification';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { isEmptyValue } from '@/lib/utils';

export default function DatabasePiTRSettings() {
  const { org } = useCurrentOrg();
  const {
    isPiTREnabled,
    setIsPiTREnabled,
    isSwitchDisabled,
    setIsNotSwitchTouched,
  } = useDatabasePiTRSettings();
  const { updatePiTRConfig, loading } = useUpdateDatabasePiTRConfig();

  const isFreeProject = isEmptyValue(org) ? false : org.plan.isFree;
  const shouldShowSwitch = isEmptyValue(org) ? false : !isFreeProject;

  function handleEnabledChange(enabled: boolean) {
    setIsPiTREnabled(enabled);
    setIsNotSwitchTouched(false);
  }

  function handleSubmit() {
    updatePiTRConfig(isPiTREnabled);
  }

  return (
    <SettingsCard>
      <SettingsCardHeader
        title="Point-in-Time Recovery"
        description="Enable Point-in-Time Recovery (PiTR)."
        control={
          shouldShowSwitch ? (
            <Switch
              checked={isPiTREnabled}
              onCheckedChange={handleEnabledChange}
              aria-label="Toggle Point-in-Time Recovery"
            />
          ) : null
        }
      />

      <SettingsCardContent className="flex flex-col lg:flex-row">
        {isFreeProject ? (
          <UpgradeNotification description="To unlock this add-on, transfer this project to a Pro or Team organization." />
        ) : (
          <InfoAlert borderLess>
            Available as an add-on for organizations on Pro, Team, or Enterprise
            plans for <strong>$100 per month.</strong>{' '}
            <TextLink href="https://nhost.io/pricing" external>
              View pricing details
            </TextLink>
          </InfoAlert>
        )}
      </SettingsCardContent>

      <SettingsCardFooter>
        <SettingsDocsLink
          href="https://docs.nhost.io/products/database/backups#point-in-time-recovery"
          title="enabling or disabling PiTR"
        />

        <ButtonWithLoading
          type="button"
          disabled={isSwitchDisabled}
          loading={loading}
          onClick={handleSubmit}
          className="w-full sm:w-auto"
        >
          Save
        </ButtonWithLoading>
      </SettingsCardFooter>
    </SettingsCard>
  );
}
