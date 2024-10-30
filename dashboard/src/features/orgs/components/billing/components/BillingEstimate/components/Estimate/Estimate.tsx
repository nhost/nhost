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

  const amountDueText = amountDue
    ? amountDue?.toLocaleString('en', { minimumFractionDigits: 2 })
    : 'N/A';

  if (loading || !amountDue) {
    return null;
  }

  return (
    <div className="flex w-full flex-row justify-between gap-8 p-4 pb-5">
      <div className="flex basis-1/2 flex-col">
        <span className="font-medium">Estimate</span>
        <span className="text-xl font-semibold">${amountDueText}</span>
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
