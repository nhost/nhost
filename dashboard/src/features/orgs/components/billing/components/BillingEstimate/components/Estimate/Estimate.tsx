import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useBillingGetNextInvoiceQuery } from '@/utils/__generated__/graphql';
import { useMemo } from 'react';

export default function Estimate() {
  const { org } = useCurrentOrg();
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
      return 'N/A';
    }
    return amount.toLocaleString('en', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [data]);

  if (loading) {
    return null;
  }

  return (
    <div className="flex w-full flex-col justify-between gap-2 p-4 md:flex-row md:gap-8">
      <div className="flex basis-1/2 flex-col">
        <span className="font-medium">Estimate</span>
        <span className="text-xl font-semibold">${amountDue}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <p className="max-w-prose">
          This estimate reflects your estimated next invoice based on current
          usage. Please note that usage data may have a processing delay of a
          few hours.
        </p>
      </div>
    </div>
  );
}
