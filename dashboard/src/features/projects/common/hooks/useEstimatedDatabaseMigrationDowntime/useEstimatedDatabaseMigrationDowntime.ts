import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useGetApplicationBackupsQuery } from '@/utils/__generated__/graphql';

function getEstimatedTimeString(diff: number): string {
  if (diff > 1000 * 3600) {
    return `${Math.floor(diff / (1000 * 3600))}hr`;
  }
  // 10 minutes is the minimum estimated downtime
  if (diff > 1000 * 60 * 10) {
    return `${Math.floor(diff / (1000 * 60))}min`;
  }

  return '10min';
}

export default function useEstimatedDatabaseMigrationDowntime() {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const isPlanFree = currentProject?.plan?.isFree;

  const { data, loading, error } = useGetApplicationBackupsQuery({
    variables: { appId: currentProject.id },
    skip: isPlanFree,
  });

  if (loading || error) {
    return '10min';
  }

  const backups = data?.app?.backups;

  let estimatedMilliseconds = 1000 * 60 * 10; // 10 minutes

  if (!isPlanFree && backups?.length > 0) {
    const lastBackup = backups[0];
    const createdAt = new Date(lastBackup.createdAt);
    const completedAt = new Date(lastBackup.completedAt);
    const diff = completedAt.valueOf() - createdAt.valueOf();
    estimatedMilliseconds = diff * 2;
  }

  const estimated = getEstimatedTimeString(estimatedMilliseconds);

  return estimated;
}
