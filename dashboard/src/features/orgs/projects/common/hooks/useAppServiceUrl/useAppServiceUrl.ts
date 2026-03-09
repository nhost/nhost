import { useCallback } from 'react';
import {
  generateAppServiceUrl,
  type NhostService,
} from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export function useAppServiceUrl() {
  const { project } = useProject();

  const getServiceUrl = useCallback(
    (service: NhostService) => {
      if (!project) {
        throw new Error(
          'Project is not available. useAppServiceUrl must be used within a project context.',
        );
      }

      return generateAppServiceUrl(project.subdomain, project.region, service);
    },
    [project],
  );

  return getServiceUrl;
}
