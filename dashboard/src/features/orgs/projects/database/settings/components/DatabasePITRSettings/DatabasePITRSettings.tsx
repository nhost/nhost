import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { useDatabasePITRSettings } from '@/features/orgs/hooks/useDatabasePITRSettings/';
import { useUpdateDatabasePITRConfig } from '@/features/orgs/hooks/useUpdateDatabasePITRConfig';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { isEmptyValue } from '@/lib/utils';

export default function DatabasePITRSettings() {
  const { org } = useCurrentOrg();
  const {
    isPITREnabled,
    setIsPITREnabled,
    isSwitchDisabled,
    setIsNotSwitchTouched,
  } = useDatabasePITRSettings();
  const { updatePITRConfig, loading } = useUpdateDatabasePITRConfig();

  const shouldShowSwitch = isEmptyValue(org) ? false : !org.plan.isFree;
  function handleEnabledChange(enabled: boolean) {
    setIsPITREnabled(enabled);
    setIsNotSwitchTouched(false);
  }

  function handleSubmit() {
    updatePITRConfig(isPITREnabled);
  }

  return (
    <SettingsContainer
      title="Point-in-time recovery"
      description="Enable Point-in-Time recovery (PITR). Available as an add-on for organizations on Pro, Team, or Enterprise plans."
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
      enabled={isPITREnabled}
      onEnabledChange={handleEnabledChange}
      docsLink="https://docs.nhost.io/product/database#point-in-time-recovery"
      docsTitle="enabling or disabling PITR"
    />
  );
}
