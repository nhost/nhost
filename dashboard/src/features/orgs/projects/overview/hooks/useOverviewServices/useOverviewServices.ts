import { useServiceStatus } from '@/features/orgs/projects/common/hooks/useServiceStatus';
import { useSoftwareVersionsInfo } from '@/features/orgs/projects/common/hooks/useSoftwareVersionsInfo';
import {
  baseServices,
  isServiceDown,
  type ServiceHealthInfo,
} from '@/features/orgs/projects/overview/health';
import { ServiceState } from '@/generated/graphql';
import { isNotEmptyValue } from '@/lib/utils';

export type OverviewServiceKey = keyof typeof baseServices | 'run';

export interface OverviewService {
  id: string;
  serviceKey: OverviewServiceKey;
  name: string;
  status?: ServiceHealthInfo;
  version?: string | null;
  recommendedVersion?: string;
  isVersionMismatch: boolean;
}

export interface OverviewServicesSummary {
  down: OverviewService[];
  updating: OverviewService[];
  versionMismatches: OverviewService[];
}

const RUN_SERVICE_PREFIX = 'run-';

/**
 * Picks the highest of the recommended versions so the overview can show a
 * single target instead of the whole list.
 */
function getHighestVersion(versions: string[]) {
  return [...versions].sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true }),
  )[0];
}

export default function useOverviewServices() {
  const {
    loading: loadingVersions,
    auth: authVersion,
    storage: storageVersion,
    postgres: postgresVersion,
    hasura: hasuraVersion,
    ai: aiVersion,
    isAIEnabled,
  } = useSoftwareVersionsInfo();

  const {
    loading: loadingStatus,
    auth,
    storage,
    postgres,
    hasura,
    ai,
    run,
  } = useServiceStatus({ shouldPoll: true });

  const coreServices: OverviewService[] = [
    { key: 'hasura-auth', status: auth, version: authVersion },
    { key: 'postgres', status: postgres, version: postgresVersion },
    { key: 'hasura-storage', status: storage, version: storageVersion },
    { key: 'hasura', status: hasura, version: hasuraVersion },
    ...(isAIEnabled ? [{ key: 'ai', status: ai, version: aiVersion }] : []),
  ].map(({ key, status, version }) => {
    const serviceKey = key as keyof typeof baseServices;

    return {
      id: serviceKey,
      serviceKey,
      name: baseServices[serviceKey].displayName,
      status,
      version: version.configuredVersion,
      recommendedVersion: getHighestVersion(version.recommendedVersions),
      isVersionMismatch: version.isVersionMismatch,
    };
  });

  const runServices: OverviewService[] = Object.values(run)
    .filter(
      (service): service is ServiceHealthInfo =>
        isNotEmptyValue(service) && service.name.startsWith(RUN_SERVICE_PREFIX),
    )
    .map((service) => ({
      id: service.name,
      serviceKey: 'run',
      name: `Run · ${service.name.slice(RUN_SERVICE_PREFIX.length)}`,
      status: service,
      isVersionMismatch: false,
    }));

  const services = [...coreServices, ...runServices];

  const summary: OverviewServicesSummary = {
    down: services.filter((service) => isServiceDown(service.status?.state)),
    updating: services.filter(
      (service) => service.status?.state === ServiceState.Updating,
    ),
    versionMismatches: services.filter((service) => service.isVersionMismatch),
  };

  return {
    loading: loadingVersions || loadingStatus,
    services,
    summary,
  };
}
