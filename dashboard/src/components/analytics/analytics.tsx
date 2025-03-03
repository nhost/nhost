import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { analytics } from '@/lib/segment';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Analytics() {
  const router = useRouter();
  const { org } = useCurrentOrg();
  const { project } = useProject();

  useEffect(() => {
    const customProperties = {
      organizationSlug: org?.slug || '',
      projectSubdomain: project?.subdomain || '',
    };

    analytics.page(customProperties);

    const handleRouteChange = () => analytics.page(customProperties);

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events, org?.slug, project?.subdomain]);

  return null;
}
