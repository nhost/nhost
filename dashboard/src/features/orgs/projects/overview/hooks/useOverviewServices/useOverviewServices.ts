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
  /**
   * The version isn't one of the recommended ones. It can be newer than
   * them, so this alone isn't a reason to warn.
   */
  isVersionMismatch: boolean;
  /**
   * A recommended version is newer than the one in use.
   */
  isUpdateAvailable: boolean;
}

export interface OverviewServicesSummary {
  down: OverviewService[];
  updating: OverviewService[];
  updatesAvailable: OverviewService[];
}

export interface OverviewHealth {
  state: ServiceState;
  /**
   * Header of the Health section, for example "All services running".
   */
  label: string;
  /**
   * One word for the pill next to the project name, for example "Healthy".
   */
  shortLabel: string;
}

const RUN_SERVICE_PREFIX = 'run-';

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * One summary for the whole page, so the pill by the title and the Health
 * header always say the same thing. Returns null when no service reported a
 * status yet: we don't know, so neither says "running".
 */
function getHealth(
  services: OverviewService[],
  { down, updating }: OverviewServicesSummary,
): OverviewHealth | null {
  if (!services.some((service) => service.status)) {
    return null;
  }

  if (down.length > 0) {
    return {
      state: ServiceState.Error,
      label: `${pluralize(down.length, 'service', 'services')} down`,
      shortLabel: 'Degraded',
    };
  }

  if (updating.length > 0) {
    return {
      state: ServiceState.Updating,
      label: `Updating ${updating.map((service) => service.name).join(', ')}`,
      shortLabel: 'Updating',
    };
  }

  return {
    state: ServiceState.Running,
    label: 'All services running',
    shortLabel: 'Healthy',
  };
}

/**
 * Picks the highest of the recommended versions so the overview can show a
 * single target instead of the whole list.
 */
function compareVersions(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true });
}

function getHighestVersion(versions: string[]) {
  return [...versions].sort((a, b) => compareVersions(b, a))[0];
}

/**
 * Only an update when the recommended version is newer. A project can run a
 * version newer than the recommended ones (Storage 0.14.0 while 0.13.0 is
 * recommended), and that's not something to fix.
 */
function isNewerVersion(candidate?: string, current?: string | null) {
  return !!candidate && !!current && compareVersions(candidate, current) > 0;
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
    const recommendedVersion = getHighestVersion(version.recommendedVersions);

    return {
      id: serviceKey,
      serviceKey,
      name: baseServices[serviceKey].displayName,
      status,
      version: version.configuredVersion,
      recommendedVersion,
      isVersionMismatch: version.isVersionMismatch,
      isUpdateAvailable:
        version.isVersionMismatch &&
        isNewerVersion(recommendedVersion, version.configuredVersion),
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
      isUpdateAvailable: false,
    }));

  const services = [...coreServices, ...runServices];

  const summary: OverviewServicesSummary = {
    down: services.filter((service) => isServiceDown(service.status?.state)),
    updating: services.filter(
      (service) => service.status?.state === ServiceState.Updating,
    ),
    updatesAvailable: services.filter((service) => service.isUpdateAvailable),
  };

  return {
    loading: loadingVersions || loadingStatus,
    services,
    summary,
    health: getHealth(services, summary),
  };
}
