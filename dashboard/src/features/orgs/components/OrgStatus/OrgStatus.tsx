import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { Organization_Status_Enum } from '@/utils/__generated__/graphql';
import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

function StatusBanner({
  title,
  description,
}: {
  title: string;
  description: React.ReactNode;
}) {
  return (
    <div className="m-4 rounded-lg bg-destructive p-4 text-white">
      <div className="flex items-center gap-2">
        <TriangleAlert className="h-4 w-4" />
        <h3 className="font-medium">{title}</h3>
      </div>
      <p>{description}</p>
    </div>
  );
}

export default function OrgStatus() {
  const { org } = useCurrentOrg();
  const { asPath, push } = useRouter();

  useEffect(() => {
    if (
      org &&
      (org.status === Organization_Status_Enum.Disabled ||
        org?.status === Organization_Status_Enum.Locked)
    ) {
      push(`/orgs/${org.slug}/billing`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asPath, org]);

  if (!org) {
    return null;
  }

  if (org.status === Organization_Status_Enum.AllowanceExceeded) {
    return (
      <StatusBanner
        title="Usage limit has been exceeded for this organization"
        description="Your project has been paused. You can either migrate it to a paid organization or wait until the billing cycle resets to unpause it."
      />
    );
  }

  if (org.status === Organization_Status_Enum.Cancelled) {
    return (
      <StatusBanner
        title="Subscription is cancelled after multiple failed billing attempts"
        description={
          <span>
            Please open a{' '}
            <Link
              href="https://app.nhost.io/support"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline"
            >
              support ticket
            </Link>{' '}
            if you need to restore access to this organization.
          </span>
        }
      />
    );
  }

  if (org.status === Organization_Status_Enum.Disabled) {
    return (
      <StatusBanner
        title="Organization is disabled after multiple failed billing attempts"
        description="All projects have been paused and new projects cannot be created until a valid payment method is provided and the outstanding invoice is closed."
      />
    );
  }

  if (org.status === Organization_Status_Enum.Locked) {
    return (
      <StatusBanner
        title="Organization is locked due to an outstanding invoice"
        description="New projects cannot be created until a valid payment method is provided and the outstanding invoice is closed. Your existing projects are not affected."
      />
    );
  }

  return null;
}
