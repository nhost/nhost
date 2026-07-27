import { useMemo } from 'react';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export interface AdminApiTarget {
  appUrl: string;
  adminSecret: string;
}

/**
 * Returns the project's GraphQL service URL and admin secret, or `null` while
 * the project is loading.
 */
export default function useAdminApiTarget(): AdminApiTarget | null {
  const { project } = useProject();

  return useMemo(() => {
    if (!project) {
      return null;
    }

    return {
      appUrl: generateAppServiceUrl(
        project.subdomain,
        project.region,
        'hasura',
      ),
      adminSecret: project.config!.hasura.adminSecret,
    };
  }, [project]);
}
