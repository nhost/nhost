import { useEffect, useRef } from 'react';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { analytics } from '@/lib/segment';
import { useAuth } from '@/providers/Auth';

export default function Analytics() {
  const { user } = useAuth();
  const { orgs } = useOrgs();
  const lastGroupedOrganizationsSignature = useRef<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      // Identity traits and the anon->user alias are owned server-side (the
      // console-next users insert/update Segment triggers) — don't add traits here.
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

  return null;
}
