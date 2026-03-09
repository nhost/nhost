import { useCallback } from 'react';
import { useAppServiceUrl } from '@/features/orgs/projects/common/hooks/useAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

function useDeleteOrphanedFiles() {
  const getServiceUrl = useAppServiceUrl();
  const storageUrl = getServiceUrl('storage');
  const deleteOrphansUrl = `${storageUrl}/ops/delete-orphans`;
  const { project } = useProject();

  const deleteOrphanedFiles = useCallback(async () => {
    // const remoteNhostClient = createClient({
    //   region: project!.region.domain,
    //   subdomain: project!.subdomain,
    // });

    // await remoteNhostClient.storage.deleteOrphanedFiles({
    //   headers: {
    //     'x-hasura-admin-secret': project!.config!.hasura.adminSecret,
    //   },
    // });
    fetch(deleteOrphansUrl, {
      method: 'POST',
      headers: {
        'x-hasura-admin-secret': project!.config!.hasura.adminSecret,
      },
    });
  }, [deleteOrphansUrl, project?.config?.hasura.adminSecret]);

  return deleteOrphanedFiles;
}

export default useDeleteOrphanedFiles;
