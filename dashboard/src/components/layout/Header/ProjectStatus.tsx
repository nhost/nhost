import { useEffect } from 'react';
import { Badge } from '@/components/ui/v3/badge';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ApplicationStatus } from '@/types/application';

export default function ProjectStatus() {
  const { project, refetch: refetchProject } = useProject();

  const isProjectUpdating =
    project?.appStates[0]?.stateId === ApplicationStatus.Updating;

  const isProjectMigratingDatabase =
    project?.appStates[0]?.stateId === ApplicationStatus.Migrating;

  // Poll for project updates
  useEffect(() => {
    if (!isProjectUpdating && !isProjectMigratingDatabase) {
      return () => {};
    }

    const interval = setInterval(async () => {
      await refetchProject();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [isProjectUpdating, isProjectMigratingDatabase, refetchProject]);

  if (isProjectUpdating) {
    return (
      <Badge className="border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400">
        Updating
      </Badge>
    );
  }

  if (isProjectMigratingDatabase) {
    return (
      <Badge className="border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400">
        Upgrading Postgres version
      </Badge>
    );
  }

  return null;
}
