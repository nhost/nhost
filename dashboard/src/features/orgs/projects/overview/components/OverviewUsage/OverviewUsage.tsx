import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { LinearProgress } from '@/components/ui/v2/LinearProgress';
import { Text } from '@/components/ui/v2/Text';
import {
  useGetAppFunctionsMetadataQuery,
  useGetProjectMetricsQuery,
  useGetRemoteAppMetricsQuery,
} from '@/generated/graphql';
import { prettifySize } from '@/utils/prettifySize';

import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

const now = new Date();

export interface UsageProgressProps {
  /**
   * The title of the current service being rendered.
   */
  label: string;
  /**
   * The amount used for a given servince on the current project.
   */
  used?: string | number;
  /**
   * The total amount of a given service.
   */
  total?: string | number;
  /**
   * The percentage of the service used.
   */
  percentage?: number;
}

export function UsageProgress({
  label,
  used,
  total,
  percentage,
}: UsageProgressProps) {
  return (
    <div className="flex flex-col space-y-3">
      <div className="flex flex-row place-content-between items-center">
        <Text variant="subtitle2" className="lg:!font-medium">
          {label}
        </Text>

        <Text className="text-xs !font-medium">
          {used} {total && <span className="opacity-80">of {total}</span>}
        </Text>
      </div>

      <LinearProgress
        variant="determinate"
        value={percentage === 0 ? -1 : percentage}
      />
    </div>
  );
}

export function OverviewUsageMetrics() {
  const { org } = useCurrentOrg();
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const remoteAppClient = useRemoteApplicationGQLClient();

  const { data: functionsInfoData, loading: functionMetricsLoading } =
    useGetAppFunctionsMetadataQuery({
      variables: { id: project?.id },
      skip: !isPlatform || !project,
    });

  const { data: projectMetrics, loading: projectMetricsLoading } =
    useGetProjectMetricsQuery({
      variables: {
        appId: project?.id,
        subdomain: project?.subdomain,
        from: new Date(now.getFullYear(), now.getMonth(), 1),
      },
      skip: !isPlatform || !project,
    });

  const { data: remoteAppMetricsData, loading: remoteAppMetricsLoading } =
    useGetRemoteAppMetricsQuery({
      client: remoteAppClient,
      skip: !project,
    });

  const metricsLoading =
    functionMetricsLoading || projectMetricsLoading || remoteAppMetricsLoading;
  // metrics for database
  const usedDatabase = projectMetrics?.postgresVolumeUsage.value || 0;
  const totalDatabase = projectMetrics?.postgresVolumeCapacity.value || 0;

  // metrics for storage
  const usedStorage =
    remoteAppMetricsData?.filesAggregate?.aggregate?.sum?.size || 0;
  const totalStorage = org?.plan?.isFree
    ? 1 * 1000 ** 3 // 1 GB
    : 50 * 1000 ** 3; // 10 GB

  // metrics for users
  const usedUsers = remoteAppMetricsData?.usersAggregate?.aggregate?.count || 0;
  const totalUsers = org?.plan?.isFree ? 10000 : 100000;

  // metrics for functions
  const usedFunctions = functionsInfoData?.app.metadataFunctions.length || 0;
  const totalFunctions = org?.plan?.isFree ? 10 : 50;
  const usedFunctionsDuration = projectMetrics?.functionsDuration.value || 0;
  const totalFunctionsDuration = org?.plan?.isFree
    ? 3600 // 1 hour
    : 3600 * 10; // 10 hours

  // metrics for egress
  const usedEgressVolume = projectMetrics?.egressVolume.value || 0;
  const totalEgressVolume = org?.plan?.isFree
    ? 5 * 1000 ** 3 // 5 GB
    : 50 * 1000 ** 3; // 50 GB

  if (metricsLoading) {
    return (
      <div className="grid grid-flow-row content-start gap-6">
        <UsageProgress label="Database" percentage={0} />
        <UsageProgress label="Storage" percentage={0} />
        <UsageProgress label="Users" percentage={0} />
        <UsageProgress label="Number of Functions" percentage={0} />
        <UsageProgress label="Functions Execution Time" percentage={0} />
        <UsageProgress label="Egress Volume" percentage={0} />
      </div>
    );
  }

  if (!isPlatform) {
    return (
      <div className="grid grid-flow-row content-start gap-6">
        <UsageProgress
          label="Database"
          used={prettifySize(0)}
          percentage={100}
        />

        <UsageProgress
          label="Storage"
          used={prettifySize(usedStorage)}
          percentage={100}
        />

        <UsageProgress label="Users" used={usedUsers} percentage={100} />

        <UsageProgress
          label="Functions"
          used={usedFunctions}
          percentage={100}
        />

        <UsageProgress
          label="Functions"
          used={usedFunctionsDuration}
          percentage={100}
        />

        <UsageProgress
          label="Egress"
          used={usedEgressVolume}
          percentage={100}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-flow-row content-start gap-6">
      <UsageProgress
        label="Database"
        used={prettifySize(usedDatabase)}
        total={prettifySize(totalDatabase)}
        percentage={(usedDatabase / totalDatabase) * 100}
      />

      <UsageProgress
        label="Storage"
        used={prettifySize(usedStorage)}
        total={prettifySize(totalStorage)}
        percentage={(usedStorage / totalStorage) * 100}
      />

      <UsageProgress
        label="Users"
        used={usedUsers}
        total={totalUsers}
        percentage={(usedUsers / totalUsers) * 100}
      />

      <UsageProgress
        label="Number of Functions"
        used={usedFunctions}
        total={totalFunctions}
        percentage={(usedFunctions / totalFunctions) * 100}
      />

      <UsageProgress
        label="Functions Execution Time"
        used={Math.trunc(usedFunctionsDuration)}
        total={`${totalFunctionsDuration} seconds`}
        percentage={(usedFunctionsDuration / totalFunctionsDuration) * 100}
      />

      <UsageProgress
        label="Egress Volume"
        used={prettifySize(usedEgressVolume)}
        total={prettifySize(totalEgressVolume)}
        percentage={(usedEgressVolume / totalEgressVolume) * 100}
      />
    </div>
  );
}

export default function OverviewUsage() {
  return (
    <div className="grid grid-flow-row content-start gap-6">
      <Text variant="h3">Usage</Text>
      <RetryableErrorBoundary>
        <OverviewUsageMetrics />
      </RetryableErrorBoundary>
    </div>
  );
}
