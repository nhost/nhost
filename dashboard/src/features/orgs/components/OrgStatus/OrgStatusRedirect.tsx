import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { Organization_Status_Enum } from '@/generated/graphql';

const BILLING_PATHNAME = '/orgs/[orgSlug]/billing';

/**
 * Keeps members of a disabled or locked organization on its billing page. It
 * renders nothing: `OrgStatusStrip` in the app layout explains the status.
 * It runs again on every navigation, so moving to another page of the
 * organization sends them back, and it does nothing on the billing page.
 */
export default function OrgStatusRedirect() {
  const { org } = useCurrentOrg();
  const status = org?.status;
  const slug = org?.slug;
  const { push, pathname } = useRouter();

  // biome-ignore lint/correctness/useExhaustiveDependencies: push does not change
  useEffect(() => {
    if (
      slug &&
      (status === Organization_Status_Enum.Disabled ||
        status === Organization_Status_Enum.Locked) &&
      pathname !== BILLING_PATHNAME
    ) {
      push(`/orgs/${slug}/billing`);
    }
  }, [pathname, status, slug]);

  return null;
}
