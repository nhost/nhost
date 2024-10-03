import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  useGetApplicationBackupsQuery,
  type GetApplicationBackupsQuery,
  type GetApplicationBackupsQueryVariables,
} from '@/utils/__generated__/graphql';
import type { QueryHookOptions } from '@apollo/client';

interface TimePeriod {
  value: number;
  unit: 'hours' | 'minutes';
  downtime: string;
  downtimeShort: string;
}

export interface UseEstimatedDatabaseMigrationDowntimeOptions
  extends QueryHookOptions<
    GetApplicationBackupsQuery,
    GetApplicationBackupsQueryVariables
  > {}

const DEFAULT_ESTIMATED_DOWNTIME: TimePeriod = {
  value: 10,
  unit: 'minutes',
  downtime: '10 minutes',
  downtimeShort: '10min',
};

function getEstimatedTime(diff: number): TimePeriod {
  if (diff > 1000 * 3600) {
    const value = Math.floor(diff / (1000 * 3600));
    const unitStr = value === 1 ? 'hour' : 'hours';
    return {
      value,
      unit: 'hours',
      downtime: `${value} ${unitStr}`,
      downtimeShort: `${value}hr`,
    };
  }
  // 10 minutes is the minimum estimated downtime
  if (diff > 1000 * 60 * 10) {
    const value = Math.floor(diff / (1000 * 60));
    const unitStr = value === 1 ? 'minute' : 'minutes';
    return {
      value,
      unit: 'minutes',
      downtime: `${value} ${unitStr}`,
      downtimeShort: `${value}min`,
    };
  }

  return DEFAULT_ESTIMATED_DOWNTIME;
}

/*
 * This hook returns the estimated downtime for a database migration.
 * The estimated downtime is calculated based on the time taken to complete the last backup.
 * If there are no backups, the estimated downtime is set to 10 minutes.
 */

export default function useEstimatedDatabaseMigrationDowntime(
  options: UseEstimatedDatabaseMigrationDowntimeOptions = {},
): TimePeriod {
  const { project } = useProject();
  const { org } = useCurrentOrg();

  const isPlanFree = org?.plan?.isFree;

  const { data, loading, error } = useGetApplicationBackupsQuery({
    ...options,
    variables: { ...options.variables, appId: project?.id },
    skip: isPlanFree,
  });

  if (loading || error) {
    return DEFAULT_ESTIMATED_DOWNTIME;
  }

  const backups = data?.app?.backups;

  let estimatedMilliseconds = 1000 * 60 * 10; // DEFAULT ESTIMATED DOWNTIME is 10 minutes

  if (!isPlanFree && backups?.length > 0) {
    const lastBackup = backups[0];
    const createdAt = new Date(lastBackup.createdAt);
    const completedAt = new Date(lastBackup.completedAt);
    const diff = completedAt.valueOf() - createdAt.valueOf();
    estimatedMilliseconds = diff * 2;
  }

  const estimated = getEstimatedTime(estimatedMilliseconds);

  return estimated;
}
