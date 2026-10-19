import type { ReactNode } from 'react';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  type GetConfiguredVersionsQuery,
  useGetConfiguredVersionsQuery,
} from '@/generated/graphql';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';
import { isVersionGte } from '@/utils/compareVersions';

export type VersionedService = Exclude<
  keyof NonNullable<GetConfiguredVersionsQuery['config']>,
  '__typename'
>;

export interface ServiceVersionGateProps {
  service: VersionedService;
  minVersion: string;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
  children: ReactNode;
}

/**
 * Renders `fallback` (nothing by default) instead of its children when the
 * project's configured `service` version is older than `minVersion`. When the
 * version can't be loaded, the children render.
 */
export default function ServiceVersionGate({
  service,
  minVersion,
  fallback = null,
  loadingFallback = null,
  children,
}: ServiceVersionGateProps) {
  const isPlatform = useIsPlatform();
  const { project } = useProject();
  const localMimirClient = useLocalMimirClient();
  const isSettingsDisabled = useSettingsDisabled();

  const { data, loading } = useGetConfiguredVersionsQuery({
    variables: { appId: project?.id },
    skip: !project?.id || isSettingsDisabled,
    fetchPolicy: 'cache-and-network',
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (loading && !data) {
    return loadingFallback;
  }

  const version = data?.config?.[service]?.version;

  if (version && !isVersionGte(version, minVersion)) {
    return fallback;
  }

  return children;
}
