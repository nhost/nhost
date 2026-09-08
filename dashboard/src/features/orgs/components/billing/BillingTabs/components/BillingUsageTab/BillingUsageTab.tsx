import { useRouter } from 'next/router';
import { BillingAccessState } from '@/features/orgs/components/billing/BillingAccessState';
import { BillingMetricsPreview } from '@/features/orgs/components/billing/BillingMetricsPreview';

export interface BillingUsageTabProps {
  isPaidOrg: boolean;
}

export default function BillingUsageTab({ isPaidOrg }: BillingUsageTabProps) {
  const router = useRouter();

  const handleUpgrade = () => {
    router.replace(
      {
        pathname: router.pathname,
        query: {
          ...router.query,
          tab: 'plan',
          openUpgradeModal: true,
        },
      },
      undefined,
      { shallow: true, scroll: false },
    );
  };

  if (!isPaidOrg) {
    return (
      <BillingAccessState
        heading="Billing usage is available on paid plans"
        description="Upgrade your organization to view billing metrics and usage."
        actionLabel="Upgrade plan"
        onAction={handleUpgrade}
      />
    );
  }

  return <BillingMetricsPreview />;
}
