import { useCallback } from 'react';
import { useAppClient } from '@/features/orgs/projects/hooks/useAppClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

function useDeleteOrphanedFiles() {
  const appClient = useAppClient();
  const { project } = useProject();

  const deleteOrphanedFiles = useCallback(
    async () =>
      await appClient.storage.deleteOrphanedFiles({
        headers: {
          'x-hasura-admin-secret': project!.config!.hasura.adminSecret,
        },
      }),
    [appClient, project?.config?.hasura.adminSecret],
  );

  return deleteOrphanedFiles;
}

export default useDeleteOrphanedFiles;
