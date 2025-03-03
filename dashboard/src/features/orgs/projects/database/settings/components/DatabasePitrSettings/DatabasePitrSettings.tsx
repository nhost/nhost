import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { useDatabasePITRSettings } from '@/features/orgs/hooks/useDatabasePITRSettings/';
import { useUpdateDatabasePITRConfig } from '@/features/orgs/hooks/useUpdateDatabasePITRConfig';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

export default function DatabasePitrSettings() {
  // const isPlatform = useIsPlatform();
  // const localMimirClient = useLocalMimirClient();
  const { org } = useCurrentOrg();

  const {
    isPITREnabled,
    setIsPITREnabled,
    isNotSwitchTouched,
    setIsNotSwitchTouched,
  } = useDatabasePITRSettings();

  const { updatePITRConfig, loading } = useUpdateDatabasePITRConfig();

  const isNotFreeProject = !org?.plan.isFree;

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
          disabled: isNotSwitchTouched,
          onClick: handleSubmit,
          loading,
        },
      }}
      className="flex flex-col lg:flex-row"
      showSwitch={isNotFreeProject}
      enabled={isPITREnabled}
      onEnabledChange={handleEnabledChange}
      docsLink="https://docs.nhost.io/product/database#point-in-time-recovery"
      docsTitle="enabling or disabling PITR"
    />
  );
}
