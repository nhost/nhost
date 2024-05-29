import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { HasuraIcon } from '@/components/ui/v2/icons/HasuraIcon';
import { ProjectHealthCard } from '@/features/projects/overview/components/ProjectHealthCard';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import { DatabaseIcon } from '@/components/ui/v2/icons/DatabaseIcon';
import { StorageIcon } from '@/components/ui/v2/icons/StorageIcon';
import { AIIcon } from '@/components/ui/v2/icons/AIIcon';
import { Box } from '@/components/ui/v2/Box';
import { ServicesIcon } from '@/components/ui/v2/icons/ServicesIcon';
import { useGetRecommendedSoftwareVersionsQuery, useGetConfiguredVersionsQuery } from '@/generated/graphql';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';

const services = {
  auth: {
    configName: "auth",
    displayName: "Auth",
    softwareVersionsName: "Auth"
  },
  hasura: {
    configName: "hasura",
    displayName: "Hasura",
    softwareVersionsName: "Hasura",
  },
  postgres: {
    configName: "postgres",
    displayName: "Postgres",
    softwareVersionsName: "PostgreSQL",
  },
  storage: {
    configName: "storage",
    displayName: "Storage",
    softwareVersionsName: "Storage"
  },
  ai: {
    configName: "ai",
    displayName: "Graphite",
    softwareVersionsName: "Graphite"
  }
} as const;

interface VersionMismatchTooltipProps {
  serviceName?: string,
  usedVersion?: string,
  recommendedVersions?: string[]
}

function VersionMismatchTooltip({ serviceName, usedVersion, recommendedVersions }: VersionMismatchTooltipProps) {
  const recommendedVersionsStr = recommendedVersions.join(", ")
  return (
    <div className="flex flex-col gap-3 px-2 py-3">
      <div className="flex flex-row justify-between gap-1">
        <Text variant="h4" component="p" className="text-white/70 font-bold" >service</Text>
        <Text variant="h4" component="p" className="text-white font-bold">{serviceName}</Text>
      </div>
      <div className="flex flex-row justify-between gap-1">
        <Text variant="h4" component="p" className="text-white/70 font-bold" >version</Text>
        <Text variant="h4" component="p" className="text-white font-bold">{usedVersion}</Text>
      </div>
      <Box sx={{ backgroundColor: "grey.600" }} className="rounded-md p-2">
        <Text variant="body1" component="p" className="text-white">
          {serviceName} is not using a recommended version. Recommended version(s): {recommendedVersionsStr}
        </Text>
      </Box>
    </div>
  )
}

export default function OverviewProjectHealth() {
  const isPlatform = useIsPlatform();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const { data: recommendedVersionsData, loading: loadingRecommendedVersions } = useGetRecommendedSoftwareVersionsQuery({
    skip: !isPlatform || !currentProject
  });

  const { data: configuredVersionsData, loading: loadingConfiguredVersions } = useGetConfiguredVersionsQuery({
    variables: {
      appId: currentProject?.id
    },
    skip: !isPlatform || !currentProject
  });

  if (loadingRecommendedVersions || loadingConfiguredVersions) {
    return (
      <div className="grid grid-flow-row content-start gap-6">
        <Text variant="h3">Project Health</Text>
        <ActivityIndicator
          delay={1000}
          label="Loading Project Health..."
          className="justify-center"
        />
      </div>
    )
  }

  const isAIServiceEnabled = !!configuredVersionsData?.config?.ai

  const getRecommendedVersions = (softwareName: string): string[] =>
    recommendedVersionsData?.softwareVersions.reduce((recommendedVersions, service) => {
      if (service.software === softwareName) {
        recommendedVersions.push(service.version)
      }
      return recommendedVersions
    }, []) ?? []

  const authRecommendedVersions = getRecommendedVersions(services.auth.softwareVersionsName)
  const hasuraRecommendedVersions = getRecommendedVersions(services.hasura.softwareVersionsName)
  const postgresRecommendedVersions = getRecommendedVersions(services.postgres.softwareVersionsName)
  const storageRecommendedVersions = getRecommendedVersions(services.storage.softwareVersionsName)
  const aiRecommendedVersions = getRecommendedVersions(services.ai.softwareVersionsName)

  // Check if configured version can't be found in recommended versions
  const isAuthVersionMismatch = !authRecommendedVersions.find(
    version => configuredVersionsData?.config?.auth?.version === version
  )

  const isHasuraVersionMismatch = !hasuraRecommendedVersions.find(
    version => configuredVersionsData?.config?.hasura?.version === version
  )

  const isPostgresVersionMismatch = !postgresRecommendedVersions.find(
    version => configuredVersionsData?.config?.postgres?.version === version
  )

  const isStorageVersionMismatch = !storageRecommendedVersions.find(
    version => configuredVersionsData?.config?.storage?.version === version
  )

  const isAIVersionMismatch = !aiRecommendedVersions.find(
    version => configuredVersionsData?.config?.ai?.version === version
  )

  const RunList = [...Array(10).keys()].map((i) =>
  (<li className="flex flex-row items-center gap-4 text-ellipsis text-nowrap leading-5">
    <Box sx={{ backgroundColor: "success.dark" }} className="flex-shrink-0 w-3 h-3 bg-success rounded-full" />
    {`nhost-run-x-y-${i + 1}`}
  </li>)
  );
  const servicesTooltipElem = (<ol className="flex flex-col gap-3 px-4 py-6 m-0">{RunList}</ol>);

  const mismatchAuthTooltipElem = isAuthVersionMismatch
    ? (<VersionMismatchTooltip
      serviceName={services.auth.displayName}
      usedVersion={configuredVersionsData?.config?.auth?.version ?? ""}
      recommendedVersions={authRecommendedVersions}
    />)
    : null;

  const mismatchHasuraTooltipElem = isHasuraVersionMismatch
    ? (<VersionMismatchTooltip
      serviceName={services.hasura.displayName}
      usedVersion={configuredVersionsData?.config?.hasura?.version ?? ""}
      recommendedVersions={hasuraRecommendedVersions}
    />)
    : null;

  const mismatchPostgresTooltipElem = isPostgresVersionMismatch
    ? (<VersionMismatchTooltip
      serviceName={services.postgres.displayName}
      usedVersion={configuredVersionsData?.config?.postgres?.version ?? ""}
      recommendedVersions={postgresRecommendedVersions}
    />)
    : null;

  const mismatchStorageTooltipElem = isStorageVersionMismatch
    ? (<VersionMismatchTooltip
      serviceName={services.storage.displayName}
      usedVersion={configuredVersionsData?.config?.storage?.version ?? ""}
      recommendedVersions={storageRecommendedVersions}
    />)
    : null;

  const mismatchAITooltipElem = isAIVersionMismatch
    ? (<VersionMismatchTooltip
      serviceName={services.ai.displayName}
      usedVersion={configuredVersionsData?.config?.ai?.version ?? ""}
      recommendedVersions={aiRecommendedVersions}
    />)
    : null;

  return (
    <div className="grid grid-flow-row content-start gap-6">
      <Text variant="h3">Project Health</Text>

      {currentProject && (
        <div className="grid grid-flow-row justify-center items-center gap-6 md:justify-start xs:grid-cols-3 lg:gap-2 xl:grid-cols-6">
          <ProjectHealthCard icon={<UserIcon className="h-6 w-6 m-1" />}
            tooltip={mismatchAuthTooltipElem}
            versionMismatch={isAuthVersionMismatch}
          />
          <ProjectHealthCard icon={<DatabaseIcon className="h-6 w-6 m-1" />}
            tooltip={mismatchPostgresTooltipElem}
            versionMismatch={isPostgresVersionMismatch}
          />
          <ProjectHealthCard icon={<StorageIcon className="h-6 w-6 m-1" />}
            tooltip={mismatchStorageTooltipElem}
            versionMismatch={isStorageVersionMismatch}
          />
          <ProjectHealthCard icon={<HasuraIcon className="h-6 w-6 m-1" />}
            tooltip={mismatchHasuraTooltipElem}
            versionMismatch={isHasuraVersionMismatch}
          />
          <ProjectHealthCard icon={<ServicesIcon className="h-6 w-6 m-1" />}
            tooltip={servicesTooltipElem}
          />
          {isAIServiceEnabled &&
            <ProjectHealthCard icon={<AIIcon className="h-6 w-6 m-1" />}
              tooltip={mismatchAITooltipElem}
              versionMismatch={isAIVersionMismatch}
            />
          }
        </div>
      )}
    </div>
  );
}
