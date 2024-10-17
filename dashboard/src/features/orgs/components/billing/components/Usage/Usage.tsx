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
  const { data } = useBillingGetNextInvoiceQuery({
    variables: {
      organizationID: org?.id,
    },
    skip: !org,
  });

  const billingItems = data?.billingGetNextInvoice?.items ?? [];
  const amountDue = data?.billingGetNextInvoice?.AmountDue ?? null;

  return (
    <div className="font-medium">
      <div className="flex flex-col w-full border rounded-md bg-background">
        <div className="flex flex-col w-full gap-1 p-4 border-b">
          <span>Usage</span>
        </div>
        <div className="flex flex-col border-b">
          <div className="flex flex-row items-center justify-between w-full p-4 border-b">
            <span>Billing cycle ({billingCycleRange})</span>
            <Progress value={progress} className="h-2 max-w-xl" />
          </div>
          <div className="flex flex-col gap-4 p-4">
            <span>Breakdown</span>
            <Table className="border rounded-md">
              <TableHeader className="w-full">
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
                    <TableCell colSpan={3}>{billingItem.Description}</TableCell>
                    <TableCell colSpan={3} className="text-right">
                      {billingItem.Amount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right">${amountDue}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
