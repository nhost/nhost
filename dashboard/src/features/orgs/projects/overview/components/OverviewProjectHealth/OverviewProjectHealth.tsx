import { useDialog } from '@/components/common/DialogProvider';
import { AIIcon } from '@/components/ui/v2/icons/AIIcon';
import { DatabaseIcon } from '@/components/ui/v2/icons/DatabaseIcon';
import { HasuraIcon } from '@/components/ui/v2/icons/HasuraIcon';
import { ServicesOutlinedIcon } from '@/components/ui/v2/icons/ServicesOutlinedIcon';
import { StorageIcon } from '@/components/ui/v2/icons/StorageIcon';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import { Text } from '@/components/ui/v2/Text';
import { useServiceStatus } from '@/features/orgs/projects/common/hooks/useServiceStatus';
import { useSoftwareVersionsInfo } from '@/features/orgs/projects/common/hooks/useSoftwareVersionsInfo';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

import { OverviewProjectHealthModal } from '@/features/orgs/projects/overview/components/OverviewProjectHealthModal';
import { ProjectHealthCard } from '@/features/orgs/projects/overview/components/ProjectHealthCard';
import { RunStatusTooltip } from '@/features/orgs/projects/overview/components/RunStatusTooltip';
import { ServiceVersionTooltip } from '@/features/orgs/projects/overview/components/ServiceVersionTooltip';

import {
  baseServices,
  findHighestImportanceState,
} from '@/features/orgs/projects/overview/health';

export default function OverviewProjectHealth() {
  const { project } = useProject();

  const { openDialog, closeDialog } = useDialog();

  const {
    loading: loadingVersions,
    auth: authVersionInfo,
    storage: storageVersionInfo,
    postgres: postgresVersionInfo,
    hasura: hasuraVersionInfo,
    ai: aiVersionInfo,
    isAIEnabled,
  } = useSoftwareVersionsInfo();

  const {
    loading: loadingProjectServicesHealth,
    auth: authStatus,
    storage: storageStatus,
    postgres: postgresStatus,
    hasura: hasuraStatus,
    ai: aiStatus,
    run: runStatus,
  } = useServiceStatus({
    shouldPoll: true,
  });

  if (loadingVersions || loadingProjectServicesHealth) {
    return (
      <div className="grid grid-flow-row content-start gap-6">
        <Text variant="h3">Project Health</Text>
        <div className="flex flex-row flex-wrap items-center justify-start gap-2 lg:gap-2">
          <ProjectHealthCard
            isLoading
            icon={<UserIcon className="m-1 h-6 w-6" />}
          />
          <ProjectHealthCard
            isLoading
            icon={<DatabaseIcon className="m-1 h-6 w-6" />}
          />
          <ProjectHealthCard
            isLoading
            icon={<StorageIcon className="m-1 h-6 w-6" />}
          />
          <ProjectHealthCard
            isLoading
            icon={<HasuraIcon className="m-1 h-6 w-6" />}
          />
        </div>
      </div>
    );
  }

  const openHealthModal = async (
    defaultExpanded: keyof typeof baseServices | 'run',
  ) => {
    openDialog({
      component: (
        <OverviewProjectHealthModal defaultExpanded={defaultExpanded} />
      ),
      props: {
        PaperProps: { className: 'p-0 max-w-2xl w-full' },
        titleProps: {
          onClose: closeDialog,
        },
      },
      title: 'Service State',
    });
  };

  const authTooltipElem = (
    <ServiceVersionTooltip
      serviceName={baseServices['hasura-auth'].displayName}
      serviceKey="hasura-auth"
      usedVersion={authVersionInfo?.configuredVersion ?? ''}
      recommendedVersionMismatch={authVersionInfo?.isVersionMismatch}
      recommendedVersions={authVersionInfo?.recommendedVersions}
      openHealthModal={openHealthModal}
      state={authStatus?.state}
    />
  );

  const hasuraTooltipElem = (
    <ServiceVersionTooltip
      serviceName={baseServices.hasura.displayName}
      serviceKey="hasura"
      usedVersion={hasuraVersionInfo?.configuredVersion ?? ''}
      recommendedVersionMismatch={hasuraVersionInfo?.isVersionMismatch}
      recommendedVersions={hasuraVersionInfo?.recommendedVersions}
      openHealthModal={openHealthModal}
      state={hasuraStatus?.state}
    />
  );

  const postgresTooltipElem = (
    <ServiceVersionTooltip
      serviceName={baseServices.postgres.displayName}
      serviceKey="postgres"
      usedVersion={postgresVersionInfo?.configuredVersion ?? ''}
      recommendedVersionMismatch={postgresVersionInfo?.isVersionMismatch}
      recommendedVersions={postgresVersionInfo?.recommendedVersions}
      openHealthModal={openHealthModal}
      state={postgresStatus?.state}
    />
  );

  const storageTooltipElem = (
    <ServiceVersionTooltip
      serviceName={baseServices['hasura-storage'].displayName}
      serviceKey="hasura-storage"
      usedVersion={storageVersionInfo?.configuredVersion ?? ''}
      recommendedVersionMismatch={storageVersionInfo?.isVersionMismatch}
      recommendedVersions={storageVersionInfo?.recommendedVersions}
      openHealthModal={openHealthModal}
      state={storageStatus?.state}
    />
  );

  const aiTooltipElem = (
    <ServiceVersionTooltip
      serviceName={baseServices.ai.displayName}
      serviceKey="ai"
      usedVersion={aiVersionInfo?.configuredVersion ?? ''}
      recommendedVersionMismatch={aiVersionInfo?.isVersionMismatch}
      recommendedVersions={aiVersionInfo?.recommendedVersions}
      openHealthModal={openHealthModal}
      state={aiStatus?.state}
    />
  );

  const runServices = Object.values(runStatus).filter((service) =>
    service?.name?.startsWith('run-'),
  );

  const runServicesStates = runServices.map((service) => service.state);

  const runServicesState = findHighestImportanceState(runServicesStates);

  return (
    <div className="grid grid-flow-row content-start gap-6">
      <Text variant="h3">Project Health</Text>

      {project && (
        <div className="flex flex-row flex-wrap items-center justify-start gap-2 lg:gap-2">
          <ProjectHealthCard
            icon={<UserIcon className="m-1 h-6 w-6" />}
            tooltip={authTooltipElem}
            isVersionMismatch={authVersionInfo?.isVersionMismatch}
            state={authStatus?.state}
          />
          <ProjectHealthCard
            icon={<DatabaseIcon className="m-1 h-6 w-6" />}
            tooltip={postgresTooltipElem}
            isVersionMismatch={postgresVersionInfo?.isVersionMismatch}
            state={postgresStatus?.state}
          />
          <ProjectHealthCard
            icon={<StorageIcon className="m-1 h-6 w-6" />}
            tooltip={storageTooltipElem}
            isVersionMismatch={storageVersionInfo?.isVersionMismatch}
            state={storageStatus?.state}
          />
          <ProjectHealthCard
            icon={<HasuraIcon className="m-1 h-6 w-6" />}
            tooltip={hasuraTooltipElem}
            isVersionMismatch={hasuraVersionInfo?.isVersionMismatch}
            state={hasuraStatus?.state}
          />
          {isAIEnabled && (
            <ProjectHealthCard
              icon={<AIIcon className="m-1 h-6 w-6" />}
              tooltip={aiTooltipElem}
              isVersionMismatch={aiVersionInfo?.isVersionMismatch}
              state={aiStatus?.state}
            />
          )}
          {Object.values(runServices).length > 0 && (
            <ProjectHealthCard
              icon={<ServicesOutlinedIcon className="m-1 h-6 w-6" />}
              tooltip={
                <RunStatusTooltip
                  servicesStatusInfo={Object.values(runServices)}
                  openHealthModal={openHealthModal}
                />
              }
              state={runServicesState}
            />
          )}
        </div>
      )}
    </div>
  );
}
