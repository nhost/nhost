import { NetworkStatus } from '@apollo/client';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { TextLink } from '@/components/ui/v3/text-link';

import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import {
  Organization_Status_Enum,
  useBillingGetNextInvoiceQuery,
} from '@/generated/graphql';
import { SUPPORT_TICKET_URL } from '@/utils/constants/common';

export default function BillingDetails() {
  const { org } = useCurrentOrg();
  const status = org?.status;
  const { data, loading, error, networkStatus, refetch } =
    useBillingGetNextInvoiceQuery({
      fetchPolicy: 'cache-first',
      notifyOnNetworkStatusChange: true,
      variables: {
        organizationID: org?.id,
      },
      skip: !org,
    });

  const isRefetching = networkStatus === NetworkStatus.refetch;
  const invoice = data?.billingGetNextInvoice;
  const billingItems = invoice?.items ?? [];
  const amountDue = invoice?.AmountDue ?? null;

  if (loading && !isRefetching) {
    return (
      <div className="flex flex-col">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex h-32 place-content-center">
            <Spinner
              size="xs"
              wrapperClassName="flex-row justify-center gap-1.5"
            >
              <span className="text-muted-foreground text-xs">
                Loading billing details...
              </span>
            </Spinner>
          </div>
        </div>
      </div>
    );
  }

  // A cancelled subscription has no next invoice, so there are no details to
  // show. The status strip at the top of the page already explains why.
  if (status === Organization_Status_Enum.Cancelled && (error || !invoice)) {
    return null;
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive" className="text-left">
          <AlertTitle>Couldn't load billing details</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>
              Try again, or{' '}
              <TextLink href={SUPPORT_TICKET_URL} external>
                open a support ticket
                <span className="sr-only">(opens in a new tab)</span>
              </TextLink>{' '}
              if this keeps happening.
            </span>
            <ButtonWithLoading
              variant="outline"
              size="sm"
              loading={isRefetching}
              onClick={() => {
                refetch().catch(() => {
                  // The error state above stays visible.
                });
              }}
            >
              Try again
            </ButtonWithLoading>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  if (!invoice) {
    return (
      <p className="p-4 text-muted-foreground text-sm">
        No upcoming invoice details are available.
      </p>
    );
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="details" className="border-none">
        <AccordionTrigger className="p-4">Details</AccordionTrigger>
        <AccordionContent className="border-t-1 pb-0">
          <div className="rounded-md">
            <Table>
              <TableHeader className="w-full bg-background">
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
              <TableFooter className="bg-background">
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
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
