import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { HasuraIcon } from '@/components/ui/v2/icons/HasuraIcon';
import { ProjectHealthCard } from '@/features/projects/overview/components/ProjectHealthCard';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import { DatabaseIcon } from '@/components/ui/v2/icons/DatabaseIcon';
import { StorageIcon } from '@/components/ui/v2/icons/StorageIcon';
import { AIIcon } from '@/components/ui/v2/icons/AIIcon';
import { Box } from '@/components/ui/v2/Box';
import { useGetRecommendedSoftwareVersionsQuery, useGetConfiguredVersionsQuery, useGetProjectServicesHealthQuery, ServiceState } from '@/generated/graphql';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useTheme } from '@mui/material';
import { ServicesOutlinedIcon } from '@/components/ui/v2/icons/ServicesOutlinedIcon';

// TODO: chore: remove hardcoded service names and versions, use data from graphql generated types
const services = {
  auth: {
    displayName: "Auth",
    softwareVersionsName: "Auth"
  },
  hasura: {
    displayName: "Hasura",
    softwareVersionsName: "Hasura",
  },
  postgres: {
    displayName: "Postgres",
    softwareVersionsName: "PostgreSQL",
  },
  storage: {
    displayName: "Storage",
    softwareVersionsName: "Storage"
  },
  ai: {
    displayName: "Graphite",
    softwareVersionsName: "Graphite"
  }
} as const;

interface VersionTooltipProps {
  serviceName?: string,
  usedVersion?: string,
  recommendedVersionMismatch?: boolean,
  recommendedVersions?: string[]
}

function VersionTooltip({ serviceName, usedVersion, recommendedVersionMismatch, recommendedVersions }: VersionTooltipProps) {
  const theme = useTheme();
  const recommendedVersionsStr = recommendedVersions.join(", ")
  return (
    <div className="flex flex-col gap-3 px-2 py-3">
      <div className="flex flex-row justify-between gap-6">
        <Text variant="h4" component="p" className="text-white/70 font-bold" >service</Text>
        <Text variant="h4" component="p" className="text-white font-bold">{serviceName}</Text>
      </div>
      <div className="flex flex-row justify-between gap-6">
        <Text variant="h4" component="p" className="text-white/70 font-bold" >version</Text>
        <Text variant="h4" component="p" className="text-white font-bold">{usedVersion}</Text>
      </div>
      {recommendedVersionMismatch && <Box sx={{ backgroundColor: theme.palette.mode === "dark" ? "grey.200" : "grey.600" }} className="rounded-md p-2">
        <Text variant="body1" component="p" className="text-white">
          {serviceName} is not using a recommended version. Recommended version(s): {recommendedVersionsStr}
        </Text>
      </Box>}
    </div>
  )
}

interface ServicesStatusTooltipProps {
  servicesStatus?: Array<{
    name: string,
    state: ServiceState
  }>
}

function ServicesStatusTooltip({ servicesStatus }: ServicesStatusTooltipProps) {
  const colorMap = {
    [ServiceState.Running]: "success.dark",
    [ServiceState.Error]: "error.main",
    [ServiceState.UpdateError]: "error.main",
    [ServiceState.Updating]: "warning.dark",
    [ServiceState.None]: "error.main",
  } as const

  return (<ol className="flex flex-col gap-3 px-4 py-6 m-0">
    {servicesStatus.map(service =>
    (<li key={service.name} className="flex flex-row items-center gap-4 text-ellipsis text-nowrap leading-5">
      <Box sx={{ backgroundColor: colorMap[service.state] }}
        className={`flex-shrink-0 w-3 h-3 rounded-full ${service.state === ServiceState.Updating ? "animate-pulse" : ""}`} />
      {service.name}
    </li>))
    }
  </ol>)
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

  const { data: projectServicesHealthData, loading: loadingProjectServicesHealth } = useGetProjectServicesHealthQuery({
    variables: {
      appId: currentProject?.id
    },
    skip: !isPlatform || !currentProject
  });

  if (loadingRecommendedVersions || loadingConfiguredVersions || loadingProjectServicesHealth) {
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

  const servicesHealth = projectServicesHealthData?.getProjectStatus?.Services.map(service => ({
    name: service.Name,
    state: service.State
  })
  ) ?? null

    const authTooltipElem = (<VersionTooltip
      serviceName={services.auth.displayName}
      usedVersion={configuredVersionsData?.config?.auth?.version ?? ""}
      recommendedVersionMismatch={isAuthVersionMismatch}
      recommendedVersions={authRecommendedVersions} />)

    const hasuraTooltipElem = (<VersionTooltip
      serviceName={services.hasura.displayName}
      usedVersion={configuredVersionsData?.config?.hasura?.version ?? ""}
      recommendedVersionMismatch={isHasuraVersionMismatch}
      recommendedVersions={hasuraRecommendedVersions} />)

    const postgresTooltipElem = (<VersionTooltip
      serviceName={services.postgres.displayName}
      usedVersion={configuredVersionsData?.config?.postgres?.version ?? ""}
      recommendedVersionMismatch={isPostgresVersionMismatch}
      recommendedVersions={postgresRecommendedVersions} />)

    const storageTooltipElem = (<VersionTooltip
      serviceName={services.storage.displayName}
      usedVersion={configuredVersionsData?.config?.storage?.version ?? ""}
      recommendedVersionMismatch={isStorageVersionMismatch}
      recommendedVersions={storageRecommendedVersions} />)

    const aiTooltipElem = (<VersionTooltip
      serviceName={services.ai.displayName}
      usedVersion={configuredVersionsData?.config?.ai?.version ?? ""}
      recommendedVersionMismatch={isAIVersionMismatch}
      recommendedVersions={aiRecommendedVersions} />)

  console.log(projectServicesHealthData)

  return (
    <div className="grid grid-flow-row content-start gap-6">
      <Text variant="h3">Project Health</Text>

      {currentProject && (
        <div className="grid grid-flow-row justify-center items-center gap-6 md:justify-start xs:grid-cols-3 lg:gap-2 xl:grid-cols-6">
          <ProjectHealthCard icon={<UserIcon className="h-6 w-6 m-1" />}
            tooltip={authTooltipElem}
            versionMismatch={isAuthVersionMismatch}
          />
          <ProjectHealthCard icon={<DatabaseIcon className="h-6 w-6 m-1" />}
            tooltip={postgresTooltipElem}
            versionMismatch={isPostgresVersionMismatch}
          />
          <ProjectHealthCard icon={<StorageIcon className="h-6 w-6 m-1" />}
            tooltip={storageTooltipElem}
            versionMismatch={isStorageVersionMismatch}
          />
          <ProjectHealthCard icon={<HasuraIcon className="h-6 w-6 m-1" />}
            tooltip={hasuraTooltipElem}
            versionMismatch={isHasuraVersionMismatch}
          />
          <ProjectHealthCard icon={<ServicesOutlinedIcon className="h-6 w-6 m-1" />}
            tooltip={<ServicesStatusTooltip servicesStatus={servicesHealth} />}
          />
          {isAIServiceEnabled &&
            <ProjectHealthCard icon={<AIIcon className="h-6 w-6 m-1" />}
              tooltip={aiTooltipElem}
              versionMismatch={isAIVersionMismatch}
            />
          }
        </div>
      )}
    </div>
  );
}
