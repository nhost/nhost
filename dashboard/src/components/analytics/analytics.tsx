import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { analytics } from '@/lib/segment';
import { useAuth } from '@/providers/Auth';

export default function Analytics() {
  const router = useRouter();
  const { user } = useAuth();
  const { org } = useCurrentOrg();
  const { orgs } = useOrgs();
  const { project } = useProject();
  const lastGroupedOrganizationsSignature = useRef<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      // Identity traits and the anon->user alias are owned server-side (the
      // console-next users insert/update Segment triggers). Only bind the
      // browser session to the user id so client-side track/page events attribute.
      analytics.identify(user.id);
    }
  }, [user?.id]);

  // Associate the user with every organization they belong to (not just the
  // one currently in view) so Attio links them to each existing workspace. The
  // group id must match the org id sent on "Organization Created".
  useEffect(() => {
    if (!user?.id) {
      lastGroupedOrganizationsSignature.current = null;
      return;
    }

    const organizationsSignature = JSON.stringify([
      user.id,
      orgs.map((membership) => [
        membership.id,
        membership.name,
        membership.slug,
        membership.plan?.name,
      ]),
    ]);

    if (lastGroupedOrganizationsSignature.current === organizationsSignature) {
      return;
    }

    orgs.forEach((membership) => {
      analytics.group(membership.id, {
        name: membership.name,
        slug: membership.slug,
        plan: membership.plan?.name,
      });
    });

    lastGroupedOrganizationsSignature.current = organizationsSignature;
  }, [user?.id, orgs]);

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
