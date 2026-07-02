import {
  createClient,
  type NhostClient,
  withAdminSession,
} from '@nhost/nhost-js';
import { useMemo } from 'react';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isNotEmptyValue } from '@/lib/utils';
import { getHasuraAdminSecret } from '@/utils/env';

export default function useAdminNhostClient(): {
  adminNhost: NhostClient | null;
} {
  const { project } = useProject();

  const adminNhost = useMemo<NhostClient | null>(() => {
    if (!isNotEmptyValue(project)) {
      return null;
    }

    const adminSecret =
      process.env.NEXT_PUBLIC_ENV === 'dev'
        ? getHasuraAdminSecret()
        : project.config?.hasura.adminSecret;

    if (!adminSecret) {
      return null;
    }

    return createClient({
      authUrl: generateAppServiceUrl(project.subdomain, project.region, 'auth'),
      graphqlUrl: generateAppServiceUrl(
        project.subdomain,
        project.region,
        'graphql',
      ),
      storageUrl: generateAppServiceUrl(
        project.subdomain,
        project.region,
        'storage',
      ),
      functionsUrl: generateAppServiceUrl(
        project.subdomain,
        project.region,
        'functions',
      ),
      aiUrl: generateAppServiceUrl(project.subdomain, project.region, 'ai'),
      configure: [withAdminSession({ adminSecret })],
    });
  }, [project]);

  return { adminNhost };
}
