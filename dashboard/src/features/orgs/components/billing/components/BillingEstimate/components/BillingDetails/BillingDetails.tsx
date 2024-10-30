import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Button } from '@/components/ui/v3/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useBillingGetNextInvoiceQuery } from '@/utils/__generated__/graphql';
import { ChevronsUpDown } from 'lucide-react';

export default function BillingDetails() {
  const { org } = useCurrentOrg();
  const { data, loading } = useBillingGetNextInvoiceQuery({
    fetchPolicy: 'cache-first',
    variables: {
      organizationID: org?.id,
    },
    skip: !org,
  });

  const billingItems = data?.billingGetNextInvoice?.items ?? [];
  const amountDue = data?.billingGetNextInvoice?.AmountDue ?? null;

  if (!data || loading) {
    return (
      <div className="flex flex-col">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex h-32 place-content-center">
            <ActivityIndicator
              label="Loading billing details..."
              className="justify-center text-sm"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex flex-1 flex-row items-center justify-between gap-2 px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="flex flex-row gap-1 pl-0 pr-4 hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <span>Details</span>
          <ChevronsUpDown className="h-5 w-5" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
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
                  <TableCell colSpan={3}>{billingItem.Description}</TableCell>
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
      </CollapsibleContent>
    </Collapsible>
  );
}
