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
import { useTheme } from '@mui/material';
import { ServicesOutlinedIcon } from '@/components/ui/v2/icons/ServicesOutlinedIcon';
import { Button } from '@/components/ui/v2/Button';
import { useDialog } from '@/components/common/DialogProvider';
import { OverviewProjectHealthModal } from '@/features/projects/overview/components/OverviewProjectHealthModal';
import { serviceStateToColor } from '../../health';

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
  recommendedVersions?: string[],
  children?: React.ReactNode
  openHealthModal?: () => void
  status?: "success" | "error" | "warning"
}

function VersionTooltip({ serviceName, usedVersion,
  recommendedVersionMismatch, recommendedVersions,
  children, openHealthModal, status }: VersionTooltipProps) {
  const theme = useTheme();
  return (
    <div className="flex flex-col gap-3 px-2 py-3">
      <div className="flex flex-row justify-between gap-6">
        <Text sx={{
          color: theme.palette.mode === "dark" ? "text.secondary" : "text.secondary"
        }} variant="h4" component="p" className="text-sm+" >service</Text>
        <Text
          sx={{
            color: theme.palette.mode === "dark" ? "text.primary" : "text.primary"
          }}
          variant="h4" component="p" className="text-sm+ font-semibold">{serviceName}</Text>
      </div>
      <div className="flex flex-row justify-between gap-6">
        <Text
          sx={{
            color: theme.palette.mode === "dark" ? "text.secondary" : "text.secondary"
          }}
          variant="h4" component="p" className="text-sm+" >version</Text>
        <Text sx={{
          color: theme.palette.mode === "dark" ? "text.primary" : "text.primary"
        }}
          variant="h4" component="p" className="font-bold text-sm+">{usedVersion}</Text>
      </div>
      {recommendedVersionMismatch && <Box sx={{ backgroundColor: theme.palette.mode === "dark" ? "grey.200" : "grey.300" }} className="rounded-md p-2">
        <Text
          sx={{
            color: theme.palette.mode === "dark" ? "text.primary" : "text.primary"
          }}
          variant="body1" component="p" className="text-sm+">
          {serviceName} is not using a recommended version. Recommended version(s):
        </Text>
        <ul className="list-disc text-sm+">
          {recommendedVersions.map(version => (
            <li className="ml-6 list-item" key={version}>
              <Text
                sx={{
                  color: theme.palette.mode === "dark" ? "text.primary" : "text.primary"
                }}
                variant="body1" component="p">
                {version}
              </Text>
            </li>
          ))}
        </ul>
      </Box>}
      {status === "error"
        ? <Box sx={{
          backgroundColor: theme.palette.mode === "dark" ? "error.dark" : "error.main",
        }}
          className="rounded-md p-2"
        >
          <Text variant="body1" component="p" className="text-white text-sm+ font-semibold">
            {serviceName} is offline due to errors, click on view logs for further details
          </Text>
        </Box>
        : null}
      <Button
        variant="outlined"
        onClick={openHealthModal}
      >
        View state
      </Button>
      {children}
    </div>
  )
}

interface ServicesStatusTooltipProps {
  servicesStatus?: Array<{
    name: string,
    state: ServiceState
  }>;
  openHealthModal?: () => void;
}

function ServicesStatusTooltip({ servicesStatus, openHealthModal }: ServicesStatusTooltipProps) {

  return (<div className="px-2 py-3 w-full flex flex-col gap-3"><ol className="flex flex-col gap-3 m-0">
    {servicesStatus.map(service =>
    (<li key={service.name} className="flex flex-row items-center gap-4 text-ellipsis text-nowrap leading-5">
      <Box sx={{ backgroundColor: serviceStateToColor.get(service.state)}}
        className={`flex-shrink-0 w-3 h-3 rounded-full ${service.state === ServiceState.Updating ? "animate-pulse" : ""}`} />
      <Text sx={{
        color: (theme) => theme.palette.mode === "dark" ? "text.primary" : "text.primary"
      }} className="font-semibold">
        {service.name}
      </Text>
    </li>))
    }
  </ol>
    <Button
      variant="outlined"
      onClick={openHealthModal}
    >
      View logs
    </Button>
  </div>
  )
}

export default function OverviewProjectHealth() {
  const isPlatform = useIsPlatform();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const { data: recommendedVersionsData, loading: loadingRecommendedVersions } = useGetRecommendedSoftwareVersionsQuery({
    skip: !isPlatform || !currentProject
  });

  const { openDialog, closeDialog } = useDialog();

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

        {currentProject && (
          <div className="flex flex-row flex-wrap justify-start items-center gap-2 lg:gap-2">
            <ProjectHealthCard icon={<UserIcon className="h-6 w-6 m-1" />}
            />
            <ProjectHealthCard icon={<DatabaseIcon className="h-6 w-6 m-1" />}
            />
            <ProjectHealthCard icon={<StorageIcon className="h-6 w-6 m-1" />}
            />
            <ProjectHealthCard icon={<HasuraIcon className="h-6 w-6 m-1" />}
            />
          </div>
        )}
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

  const servicesHealth = projectServicesHealthData?.getProjectStatus?.services.map(service => ({
    name: service.name,
    state: service.state
  })
  ) ?? null

  const getServiceHealthState = (serviceName: string): "success" | "error" | "warning" => {
    const serviceHealth = servicesHealth?.find(service => service.name === serviceName)
    if (!serviceHealth) {
      return "error"
    }
    switch (serviceHealth.state) {
      case ServiceState.Running:
        return "success"
      case ServiceState.Error:
        return "error"
      case ServiceState.UpdateError:
        return "error"
      case ServiceState.Updating:
        return "warning"
      default:
        return "error"
    }
  }

  const getUserRunServiceState = (runServices: Array<{ name: string, state: ServiceState }>): "success" | "error" | "warning" => {
    if (runServices.some(service => service.state === ServiceState.Error
      || service.state === ServiceState.UpdateError
      || service.state === ServiceState.None
    )) {
      return "error"
    }

    if (runServices.some(service => service.state === ServiceState.Updating)) {
      return "warning"
    }

    return "success"
  }

  const openHealthModal = async () => {
    openDialog({
      component: (
        <OverviewProjectHealthModal
          servicesHealth={projectServicesHealthData}
        />
      ),
      props: {
        PaperProps: { className: 'p-0 max-w-2xl w-full' },
        titleProps: {
          onClose: closeDialog,
        }
      },
      title: "Service logs",
    })
  }

  const authTooltipElem = (<VersionTooltip
    serviceName={services.auth.displayName}
    usedVersion={configuredVersionsData?.config?.auth?.version ?? ""}
    recommendedVersionMismatch={isAuthVersionMismatch}
    recommendedVersions={authRecommendedVersions}
    openHealthModal={openHealthModal}
    status={getServiceHealthState("hasura-auth")}
  />
  )

  const hasuraTooltipElem = (<VersionTooltip
    serviceName={services.hasura.displayName}
    usedVersion={configuredVersionsData?.config?.hasura?.version ?? ""}
    recommendedVersionMismatch={isHasuraVersionMismatch}
    recommendedVersions={hasuraRecommendedVersions}
    openHealthModal={openHealthModal}
    status={getServiceHealthState("hasura")}
  />)

  const postgresTooltipElem = (<VersionTooltip
    serviceName={services.postgres.displayName}
    usedVersion={configuredVersionsData?.config?.postgres?.version ?? ""}
    recommendedVersionMismatch={isPostgresVersionMismatch}
    recommendedVersions={postgresRecommendedVersions}
    openHealthModal={openHealthModal}
    status={getServiceHealthState("postgres")}
  />)

  const storageTooltipElem = (<VersionTooltip
    serviceName={services.storage.displayName}
    usedVersion={configuredVersionsData?.config?.storage?.version ?? ""}
    recommendedVersionMismatch={isStorageVersionMismatch}
    recommendedVersions={storageRecommendedVersions}
    openHealthModal={openHealthModal}
    status={getServiceHealthState("hasura-storage")}
  />)

  const aiTooltipElem = (<VersionTooltip
    serviceName={services.ai.displayName}
    usedVersion={configuredVersionsData?.config?.ai?.version ?? ""}
    recommendedVersionMismatch={isAIVersionMismatch}
    recommendedVersions={aiRecommendedVersions}
    openHealthModal={openHealthModal}
    status={getServiceHealthState("ai")}
  />)


  const userRunServices = servicesHealth.filter(service => service.name.startsWith("run-"))

  return (
    <div className="grid grid-flow-row content-start gap-6">
      <Text variant="h3">Project Health</Text>

      {currentProject && (
        <div className="flex flex-row flex-wrap justify-start items-center gap-2 lg:gap-2">
          <ProjectHealthCard icon={<UserIcon className="h-6 w-6 m-1" />}
            tooltip={authTooltipElem}
            versionMismatch={isAuthVersionMismatch}
            status={getServiceHealthState("hasura-auth")}
          />
          <ProjectHealthCard icon={<DatabaseIcon className="h-6 w-6 m-1" />}
            tooltip={postgresTooltipElem}
            versionMismatch={isPostgresVersionMismatch}
            status={getServiceHealthState("postgres")}
          />
          <ProjectHealthCard icon={<StorageIcon className="h-6 w-6 m-1" />}
            tooltip={storageTooltipElem}
            versionMismatch={isStorageVersionMismatch}
            status={getServiceHealthState("hasura-storage")}
          />
          <ProjectHealthCard icon={<HasuraIcon className="h-6 w-6 m-1" />}
            tooltip={hasuraTooltipElem}
            versionMismatch={isHasuraVersionMismatch}
            status={getServiceHealthState("hasura")}
          />
          {isAIServiceEnabled &&
            <ProjectHealthCard icon={<AIIcon
              className="h-6 w-6 m-1" />}
              tooltip={aiTooltipElem}
              versionMismatch={isAIVersionMismatch}
              status={getServiceHealthState("ai")}
            />
          }
          {userRunServices.length > 0 &&
            <ProjectHealthCard icon={<ServicesOutlinedIcon className="h-6 w-6 m-1" />}
              tooltip={<ServicesStatusTooltip
                servicesStatus={userRunServices}
                openHealthModal={openHealthModal}
              />}
              status={getUserRunServiceState(userRunServices)}
            />
          }
        </div>
      )}
    </div>
  );
}
