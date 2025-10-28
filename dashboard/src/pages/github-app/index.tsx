import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useNhostClient } from '@/providers/nhost';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function GithubAppLoaderPage() {
  const nhost = useNhostClient();
  const router = useRouter();
  const { project, loading } = useProject();

  useEffect(() => {
    if (!router.isReady || loading || !nhost.auth) {
      return;
    }

    const { state } = router.query;

    if (state === 'normal-path') {
      let redirectURL = nhost.auth.signInProviderURL('github');

      const params = new URLSearchParams(
        router.query as Record<string, string>,
      ).toString();

      if (params) {
        redirectURL += `/callback?${params}`;
      }

      window.location.href = redirectURL;
    } else if (typeof state === 'string' && /^[a-z]+\/[a-z]+$/.test(state)) {
      const [orgSlug, appSubdomain] = state.split('/');
      if (orgSlug && appSubdomain) {
        const { state: _, ...rest } = router.query;

        router.replace({
          pathname: `/${orgSlug}/projects/${appSubdomain}/settings/git/`,
          query: { openGitHubModal: 'true', ...rest },
        });
      }
    }
  }, [router, project, loading, nhost]);

  return <div>Loading...</div>;
}
