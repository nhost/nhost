import { useEffect } from 'react';
import { Badge } from '@/components/ui/v3/badge';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ApplicationStatus } from '@/types/application';

const WARNING_BADGE =
  'pointer-events-none border-transparent font-medium bg-warning/20 text-warning';

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
      <Badge variant="outline" className={WARNING_BADGE}>
        Updating
      </Badge>
    );
  }

  if (isProjectMigratingDatabase) {
    return (
      <Badge variant="outline" className={WARNING_BADGE}>
        Upgrading Postgres version
      </Badge>
    );
  }

  return null;
}
