import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Progress } from '@/components/ui/v3/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { getBillingCycleInfo } from '@/features/orgs/components/billing/utils/getBillingCycle';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useBillingGetNextInvoiceQuery } from '@/utils/__generated__/graphql';

export default function BillingCycle() {
  const { org } = useCurrentOrg();
  const { billingCycleRange, progress } = getBillingCycleInfo();
  const { data, loading } = useBillingGetNextInvoiceQuery({
    fetchPolicy: 'cache-first',
    variables: {
      organizationID: org?.id,
    },
    skip: !org,
  });

  const billingItems = data?.billingGetNextInvoice?.items ?? [];
  const amountDue = data?.billingGetNextInvoice?.AmountDue ?? null;

  return (
    <div className="flex flex-col">
      <div className="flex w-full flex-row items-center justify-between border-b border-t p-4">
        <span>Billing cycle ({billingCycleRange})</span>
        <Progress value={progress} className="h-2 max-w-xl" />
      </div>
      <div className="flex flex-col gap-4 p-4">
        {loading && (
          <div className="flex h-32 place-content-center">
            <ActivityIndicator
              label="Loading usage stats..."
              className="justify-center text-sm"
            />
          </div>
        )}

        {!loading && data && (
          <>
            <span>Breakdown</span>
            <div className="rounded-md border">
              <Table>
                <TableHeader className="w-full bg-accent">
                  <TableRow>
                    <TableHead colSpan={3} className="w-full rounded-tl-md">
                      Item
                    </TableHead>
                    <TableHead className="rounded-tr-md text-right">
                      Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billingItems.map((billingItem) => (
                    <TableRow key={billingItem.Description}>
                      <TableCell colSpan={3}>
                        {billingItem.Description}
                      </TableCell>
                      <TableCell colSpan={3} className="text-right">
                        ${billingItem.Amount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="bg-accent">
                  <TableRow>
                    <TableCell colSpan={3} className="rounded-bl-md">
                      Total
                    </TableCell>
                    <TableCell className="rounded-br-md text-right">
                      ${amountDue}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
