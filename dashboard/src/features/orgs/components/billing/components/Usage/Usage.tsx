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

export default function Usage() {
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
    <div className="font-medium">
      <div className="flex w-full flex-col rounded-md border bg-background">
        <div className="flex w-full flex-col gap-1 border-b p-4">
          <span>Usage</span>
        </div>
        <div className="flex flex-col border-b">
          <div className="flex w-full flex-row items-center justify-between border-b p-4">
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
                        <TableHead colSpan={3} className="w-full">
                          Item
                        </TableHead>
                        <TableHead className="text-right">Amount</TableHead>
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
                        <TableCell colSpan={3}>Total</TableCell>
                        <TableCell className="text-right">
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
      </div>
    </div>
  );
}
