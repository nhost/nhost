import { Chip } from '@/components/ui/v2/Chip';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ApplicationStatus } from '@/types/application';
import { useEffect } from 'react';

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
    return <Chip size="small" label="Updating" color="warning" />;
  }

  if (isProjectMigratingDatabase) {
    return (
      <Chip size="small" label="Upgrading Postgres version" color="warning" />
    );
  }

  return null;
}
