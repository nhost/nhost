import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useBillingGetNextInvoiceQuery } from '@/utils/__generated__/graphql';

export default function Estimate() {
  const { org } = useCurrentOrg();
  const { data, loading } = useBillingGetNextInvoiceQuery({
    fetchPolicy: 'cache-first',
    variables: {
      organizationID: org?.id,
    },
    skip: !org,
  });

  const amountDue = data?.billingGetNextInvoice?.AmountDue ?? null;

  if (loading || !amountDue) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 border-b p-4">
      <div className="flex w-full flex-col">
        <div className="flex flex-row items-center gap-2">
          <span className="text-muted-foreground">Estimate</span>
          <span>
            This estimate reflects your estimated next invoice based on current
            usage. Please note that usage data may have a processing delay of a
            few hours.
          </span>
        </div>
        <span className="text-xl font-bold">${amountDue}</span>
      </div>
    </div>
  );
}
