import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { Organization_Status_Enum } from '@/utils/__generated__/graphql';
import { TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

function StatusBanner({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="w-full p-4 text-white bg-destructive">
      <div className="flex items-center gap-2">
        <TriangleAlert className="w-4 h-4" />
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
        title="Usage Limit Exceeded"
        description="Your organization has exceeded its usage allowance. Please review your billing."
      />
    );
  }

  if (org.status === Organization_Status_Enum.Cancelled) {
    return (
      <StatusBanner
        title="Subscription cancelled"
        description="Your subscription has been cancelled. Contact support to restore access."
      />
    );
  }

  if (org.status === Organization_Status_Enum.Disabled) {
    return (
      <StatusBanner
        title={`Organization ${org.name} is disabled`}
        description="This organization has been disabled due to unpaid invoices for 20 days. Please settle your payment."
      />
    );
  }

  if (org.status === Organization_Status_Enum.Locked) {
    return (
      <StatusBanner
        title={`Organization ${org.name} is locked`}
        description="Your organization is locked due to an outstanding invoice. Please settle your payment to unlock access."
      />
    );
  }

  return null;
}
