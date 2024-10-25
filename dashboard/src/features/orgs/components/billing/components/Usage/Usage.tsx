import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { Button } from '@/components/ui/v3/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';
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
import { ChevronsUpDown } from 'lucide-react';
import { SpendingWarnings } from './components/SpendingWarnings';

export default function Usage() {
  const { org } = useCurrentOrg();
  const { progress, billingCycleStart, billingCycleEnd } =
    getBillingCycleInfo();
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
        <div className="flex w-full flex-col gap-1 p-4">
          <span className="text-xl font-medium">Billing Estimate</span>
        </div>
        <div className="flex flex-col">
          <div className="flex w-full flex-col gap-1 border-b border-t p-4 pb-5">
            <span className="font-medium">Current billing cycle</span>
            <div className="flex max-w-xl flex-col">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {billingCycleStart}
                </span>
                <span className="text-muted-foreground">{billingCycleEnd}</span>
              </div>
              <Progress value={progress} className="h-2 max-w-xl" />
            </div>
          </div>
          {!!amountDue && (
            <>
              <div className="flex flex-col gap-2 border-b p-4">
                <div className="flex w-full flex-col">
                  <div className="flex flex-row items-center gap-2">
                    <span className="text-muted-foreground">Estimate</span>
                    <Tooltip
                      placement="right"
                      title={
                        <span>
                          This estimate reflects your estimated next invoice
                          based on current usage. Please note that usage data
                          may have a processing delay of a few hours.
                        </span>
                      }
                    >
                      <InfoIcon
                        aria-label="Info"
                        className="h-4 w-4"
                        color="primary"
                      />
                    </Tooltip>
                  </div>
                  <span className="text-xl font-bold">${amountDue}</span>
                </div>
              </div>

              <SpendingWarnings />
            </>
          )}
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
              <Collapsible>
                <CollapsibleTrigger className="flex flex-1 flex-row items-center justify-between gap-2 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex flex-row gap-1 pl-0 pr-4 hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  >
                    <span>More details</span>
                    <ChevronsUpDown className="h-5 w-5" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader className="w-full bg-accent">
                        <TableRow>
                          <TableHead
                            colSpan={3}
                            className="w-full rounded-tl-md"
                          >
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
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
