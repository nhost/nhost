import { useMemo } from 'react';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export interface AdminApiTarget {
  appUrl: string;
  adminSecret: string;
}

/**
 * Returns the project's GraphQL service URL and admin secret, or `null` while
 * the project or its Hasura configuration is unavailable.
 */
export default function useAdminApiTarget(): AdminApiTarget | null {
  const { project } = useProject();

  return useMemo(() => {
    const adminSecret = project?.config?.hasura.adminSecret;

    if (!project || !adminSecret) {
      return null;
    }

    return {
      appUrl: generateAppServiceUrl(
        project.subdomain,
        project.region,
        'hasura',
      ),
      adminSecret,
    };
  }, [project]);
}
