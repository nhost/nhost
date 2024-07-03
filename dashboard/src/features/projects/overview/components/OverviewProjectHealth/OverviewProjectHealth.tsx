import { useDialog } from '@/components/common/DialogProvider';
import { AIIcon } from '@/components/ui/v2/icons/AIIcon';
import { DatabaseIcon } from '@/components/ui/v2/icons/DatabaseIcon';
import { HasuraIcon } from '@/components/ui/v2/icons/HasuraIcon';
import { ServicesOutlinedIcon } from '@/components/ui/v2/icons/ServicesOutlinedIcon';
import { StorageIcon } from '@/components/ui/v2/icons/StorageIcon';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useRecommendedVersions } from '@/features/projects/common/hooks/useRecommendedVersions';
import { useServiceStatus } from '@/features/projects/common/hooks/useServiceStatus';
import { OverviewProjectHealthModal } from '@/features/projects/overview/components/OverviewProjectHealthModal';
import { ProjectHealthCard } from '@/features/projects/overview/components/ProjectHealthCard';
import { RunStatusTooltip } from '@/features/projects/overview/components/RunStatusTooltip';
import { ServiceVersionTooltip } from '@/features/projects/overview/components/ServiceVersionTooltip';
import {
  baseServices,
  findHighestImportanceState,
} from '@/features/projects/overview/health';
import { useGetConfiguredVersionsQuery } from '@/generated/graphql';

export default function OverviewProjectHealth() {
  const isPlatform = useIsPlatform();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const {
    loading: loadingRecommendedVersions,
    auth: authRecommendedVersions,
    storage: storageRecommendedVersions,
    postgres: postgresRecommendedVersions,
    hasura: hasuraRecommendedVersions,
    ai: aiRecommendedVersions,
  } = useRecommendedVersions({
    pollInterval: 10000,
  });

  const { openDialog, closeDialog } = useDialog();

  const { data: configuredVersionsData, loading: loadingConfiguredVersions } =
    useGetConfiguredVersionsQuery({
      variables: {
        appId: currentProject?.id,
      },
      skip: !isPlatform || !currentProject,
      pollInterval: 10000,
    });

  const {
    loading: loadingProjectServicesHealth,
    auth: authStatus,
    storage: storageStatus,
    postgres: postgresStatus,
    hasura: hasuraStatus,
    ai: aiStatus,
    run: runStatus,
  } = useServiceStatus({
    pollInterval: 10000,
  });

  if (
    loadingRecommendedVersions ||
    loadingConfiguredVersions ||
    loadingProjectServicesHealth
  ) {
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

  const isAIServiceEnabled = !!configuredVersionsData?.config?.ai;

  // Check if configured version can't be found in recommended versions
  const isAuthVersionMismatch = !authRecommendedVersions.find(
    (version) => configuredVersionsData?.config?.auth?.version === version,
  );

  const isHasuraVersionMismatch = !hasuraRecommendedVersions.find(
    (version) => configuredVersionsData?.config?.hasura?.version === version,
  );

  const isPostgresVersionMismatch = !postgresRecommendedVersions.find(
    (version) => configuredVersionsData?.config?.postgres?.version === version,
  );

  const isStorageVersionMismatch = !storageRecommendedVersions.find(
    (version) => configuredVersionsData?.config?.storage?.version === version,
  );

  const isAIVersionMismatch = !aiRecommendedVersions.find(
    (version) => configuredVersionsData?.config?.ai?.version === version,
  );

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
      usedVersion={configuredVersionsData?.config?.auth?.version ?? ''}
      recommendedVersionMismatch={isAuthVersionMismatch}
      recommendedVersions={authRecommendedVersions}
      openHealthModal={openHealthModal}
      state={authStatus?.state}
    />
  );

  const hasuraTooltipElem = (
    <ServiceVersionTooltip
      serviceName={baseServices.hasura.displayName}
      serviceKey="hasura"
      usedVersion={configuredVersionsData?.config?.hasura?.version ?? ''}
      recommendedVersionMismatch={isHasuraVersionMismatch}
      recommendedVersions={hasuraRecommendedVersions}
      openHealthModal={openHealthModal}
      state={hasuraStatus?.state}
    />
  );

  const postgresTooltipElem = (
    <ServiceVersionTooltip
      serviceName={baseServices.postgres.displayName}
      serviceKey="postgres"
      usedVersion={configuredVersionsData?.config?.postgres?.version ?? ''}
      recommendedVersionMismatch={isPostgresVersionMismatch}
      recommendedVersions={postgresRecommendedVersions}
      openHealthModal={openHealthModal}
      state={postgresStatus?.state}
    />
  );

  const storageTooltipElem = (
    <ServiceVersionTooltip
      serviceName={baseServices['hasura-storage'].displayName}
      serviceKey="hasura-storage"
      usedVersion={configuredVersionsData?.config?.storage?.version ?? ''}
      recommendedVersionMismatch={isStorageVersionMismatch}
      recommendedVersions={storageRecommendedVersions}
      openHealthModal={openHealthModal}
      state={storageStatus?.state}
    />
  );

  const aiTooltipElem = (
    <ServiceVersionTooltip
      serviceName={baseServices.ai.displayName}
      serviceKey="ai"
      usedVersion={configuredVersionsData?.config?.ai?.version ?? ''}
      recommendedVersionMismatch={isAIVersionMismatch}
      recommendedVersions={aiRecommendedVersions}
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

      {currentProject && (
        <div className="flex flex-row flex-wrap items-center justify-start gap-2 lg:gap-2">
          <ProjectHealthCard
            icon={<UserIcon className="m-1 h-6 w-6" />}
            tooltip={authTooltipElem}
            isVersionMismatch={isAuthVersionMismatch}
            state={authStatus?.state}
          />
          <ProjectHealthCard
            icon={<DatabaseIcon className="m-1 h-6 w-6" />}
            tooltip={postgresTooltipElem}
            isVersionMismatch={isPostgresVersionMismatch}
            state={postgresStatus?.state}
          />
          <ProjectHealthCard
            icon={<StorageIcon className="m-1 h-6 w-6" />}
            tooltip={storageTooltipElem}
            isVersionMismatch={isStorageVersionMismatch}
            state={storageStatus?.state}
          />
          <ProjectHealthCard
            icon={<HasuraIcon className="m-1 h-6 w-6" />}
            tooltip={hasuraTooltipElem}
            isVersionMismatch={isHasuraVersionMismatch}
            state={hasuraStatus?.state}
          />
          {isAIServiceEnabled && (
            <ProjectHealthCard
              icon={<AIIcon className="m-1 h-6 w-6" />}
              tooltip={aiTooltipElem}
              isVersionMismatch={isAIVersionMismatch}
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
