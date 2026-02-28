import { useMemo } from 'react';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetProjectsQuery } from '@/utils/__generated__/graphql';

function useImportBackupSourceProjectList() {
  const { org } = useCurrentOrg();
  const { project } = useProject();

  const currentProjectRegionId = project?.region.id;
  const projectId = project?.id;
  const { data, loading } = useGetProjectsQuery({
    variables: {
      orgSlug: org?.slug,
    },
  });
  const filteredProjects = useMemo(
    () =>
      (data?.apps || [])
        .filter(
          (app) =>
            app.id !== projectId && app.region.id === currentProjectRegionId,
        )
        .map((app) => ({
          label: `${app.name} (${app.region.name})`,
          id: app.id,
        })),
    [data?.apps, currentProjectRegionId, projectId],
  );
  return { filteredProjects, loading };
}

export default useImportBackupSourceProjectList;
