import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { Organization_Status_Enum } from '@/generated/graphql';

/**
 * Sends members of a disabled or locked organization to its billing page. It
 * renders nothing: `OrgStatusStrip` in the app layout explains the status.
 * It sits in each scope so it runs again whenever a new page mounts.
 */
export default function OrgStatusRedirect() {
  const { org } = useCurrentOrg();
  const { push } = useRouter();

  // biome-ignore lint/correctness/useExhaustiveDependencies: push does not change
  useEffect(() => {
    if (
      org &&
      (org.status === Organization_Status_Enum.Disabled ||
        org.status === Organization_Status_Enum.Locked)
    ) {
      push(`/orgs/${org.slug}/billing`);
    }
  }, [org]);

  return null;
}
