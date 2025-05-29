import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useEffect } from 'react';
import { setHasuraContext } from '../hasura-mutator';

/**
 * Shared hook that sets up Hasura context for any operation.
 * Handles project subdomain, region, admin secret, and URL configuration.
 */
export function useHasuraContext() {
  const { project } = useProject();

  useEffect(() => {
    if (project) {
      setHasuraContext({
        projectSubdomain: project.subdomain,
        projectRegion: project.region,
        adminSecret: project.config?.hasura.adminSecret,
        // Override URL for local development if needed
        appUrl:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? 'https://local.hasura.local.nhost.run'
            : undefined,
      });
    }
  }, [project]);

  return project;
}
