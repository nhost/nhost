import { useMemo } from 'react';

import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import {
  Organization_Status_Enum,
  useBillingGetNextInvoiceQuery,
} from '@/generated/graphql';

export default function Estimate() {
  const { org } = useCurrentOrg();
  const status = org?.status;
  const { data, loading } = useBillingGetNextInvoiceQuery({
    fetchPolicy: 'cache-first',
    variables: {
      organizationID: org?.id,
    },
    skip: !org,
  });

  const amountDue = useMemo(() => {
    const amount = data?.billingGetNextInvoice?.AmountDue;
    if (typeof amount !== 'number') {
      return null;
    }
    const formatted = amount.toLocaleString('en', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `$${formatted}`;
  }, [data]);

  if (loading) {
    return null;
  }

  // A cancelled subscription has no next invoice to estimate.
  const isCancelledWithoutInvoice =
    status === Organization_Status_Enum.Cancelled && !amountDue;

  let unavailableLabel = 'Not available';
  let description =
    'This estimate reflects your estimated next invoice based on current usage. Please note that usage data may have a processing delay of a few hours.';
  if (isCancelledWithoutInvoice) {
    unavailableLabel = 'No upcoming invoice';
    description =
      "This subscription is cancelled, so there's no next invoice to estimate.";
  }

  return (
    <div className="flex w-full flex-col justify-between gap-2 p-4 md:flex-row md:gap-8">
      <div className="flex basis-1/2 flex-col">
        <span className="font-medium">Estimate</span>
        {amountDue ? (
          <span className="font-semibold text-xl">{amountDue}</span>
        ) : (
          <span className="font-semibold text-muted-foreground text-xl">
            {unavailableLabel}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <p className="max-w-prose">{description}</p>
      </div>
    </div>
  );
}
