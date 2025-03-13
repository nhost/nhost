import { SettingsContainer } from '@/components/layout/SettingsContainer';
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
    <SettingsContainer
      title="Point-in-time recovery"
      description="Enable Point-in-Time recovery (PiTR). Available as an add-on for organizations on Pro, Team, or Enterprise plans."
      slotProps={{
        submitButton: {
          disabled: isSwitchDisabled,
          onClick: handleSubmit,
          loading,
          type: 'button',
        },
      }}
      className="flex flex-col lg:flex-row"
      showSwitch={shouldShowSwitch}
      enabled={isPiTREnabled}
      onEnabledChange={handleEnabledChange}
      docsLink="https://docs.nhost.io/product/database#point-in-time-recovery"
      docsTitle="enabling or disabling PiTR"
    >
      {isFreeProject && (
        <UpgradeNotification description="To unlock this add-on, transfer this project to a Pro or Team organization." />
      )}
    </SettingsContainer>
  );
}
