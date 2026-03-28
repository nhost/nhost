import { useCallback, useEffect, useState } from 'react';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

const FALLBACK_SCOPES = ['openid', 'profile', 'email', 'offline_access'];

export default function useAvailableScopes() {
  const { project } = useProject();
  const [scopes, setScopes] = useState<string[]>(FALLBACK_SCOPES);
  const [loading, setLoading] = useState(true);

  const fetchScopes = useCallback(async () => {
    if (!project) {
      return;
    }

    try {
      const authUrl = generateAppServiceUrl(
        project.subdomain,
        project.region,
        'auth',
      );
      const response = await fetch(
        `${authUrl}/.well-known/openid-configuration`,
      );

      if (response.ok) {
        const data = await response.json();
        if (
          Array.isArray(data.scopes_supported) &&
          data.scopes_supported.length > 0
        ) {
          setScopes(data.scopes_supported);
        }
      }
    } catch {
      // fall back to default scopes silently
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    fetchScopes();
  }, [fetchScopes]);

  return { scopes, loading };
}
