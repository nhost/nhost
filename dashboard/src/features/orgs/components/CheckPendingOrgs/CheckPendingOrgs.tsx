import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/v3/alert-dialog';
import { buttonVariants } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { StripeEmbeddedForm } from '@/features/orgs/components/StripeEmbeddedForm';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import {
  CheckoutStatus,
  useOrganizationNewRequestsLazyQuery,
  usePostOrganizationRequestMutation,
  type PostOrganizationRequestResponse,
} from '@/utils/__generated__/graphql';
import { useUserData } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function CheckPendingOrgs() {
  const userData = useUserData();
  const { refetch: refetchOrgs } = useOrgs();
  const { asPath, push } = useRouter();

  const [stripeFormDialogOpen, setStripeFormDialogOpen] = useState(false);
  const [orgStatusOpenDialogOpen, setOrgStatusOpenDialogOpen] = useState(false);
  const [orgStatusCompleteDialogOpen, setOrgStatusCompleteDialogOpen] =
    useState(false);

  const [pendingOrgRequest, setPendingOrgRequest] =
    useState<PostOrganizationRequestResponse | null>(null);
  const [postOrganizationRequest] = usePostOrganizationRequestMutation();
  const [getOrganizationNewRequests] = useOrganizationNewRequestsLazyQuery();

  useEffect(() => {
    const checkForPendingOrgRequests = async () => {
      const { data: { organizationNewRequests = [] } = {} } =
        await getOrganizationNewRequests({
          variables: {
            userID: userData.id,
          },
        });

      if (organizationNewRequests.length > 0) {
        const { sessionID } = organizationNewRequests.at(0);

        const {
          data: { billingPostOrganizationRequest },
        } = await postOrganizationRequest({
          variables: {
            sessionID,
          },
        });

        const { Status } = billingPostOrganizationRequest;

        switch (Status) {
          case CheckoutStatus.Open:
            setPendingOrgRequest(billingPostOrganizationRequest);
            setOrgStatusOpenDialogOpen(true);
            break;

          case CheckoutStatus.Completed:
            setPendingOrgRequest(billingPostOrganizationRequest);
            setOrgStatusCompleteDialogOpen(true);
            break;

          case CheckoutStatus.Expired:
            // Do nothing
            break;

          default:
            break;
        }
      }
    };

    if (userData && asPath !== '/') {
      checkForPendingOrgRequests();
    }
  }, [asPath, userData, getOrganizationNewRequests, postOrganizationRequest]);

  return (
    <>
      <AlertDialog
        open={orgStatusOpenDialogOpen}
        onOpenChange={setOrgStatusOpenDialogOpen}
      >
        <AlertDialogContent className="text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>
              You have previously tried to create a new organization
            </AlertDialogTitle>
            <AlertDialogDescription>
              Please continue with checkout to finalize creating the
              organization
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setOrgStatusOpenDialogOpen(false);
                await new Promise((resolve) => {
                  setTimeout(resolve, 500);
                });
                setStripeFormDialogOpen(true);
              }}
              className={buttonVariants({ variant: 'default' })}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={orgStatusCompleteDialogOpen}
        onOpenChange={setOrgStatusCompleteDialogOpen}
      >
        <AlertDialogContent className="text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>
              You've recenly created a new Organization
            </AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to continue to the new Organization
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ignore</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setOrgStatusOpenDialogOpen(false);
                await refetchOrgs();
                await push(`/orgs/${pendingOrgRequest.Slug}/projects`);
              }}
              className={buttonVariants({ variant: 'default' })}
            >
              Continue to new Organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={stripeFormDialogOpen}
        onOpenChange={setStripeFormDialogOpen}
      >
        <DialogContent
          className="text-black bg-white sm:max-w-xl"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Create Organization Checkout Form</DialogTitle>
            <DialogDescription />
          </DialogHeader>

          {pendingOrgRequest && (
            <StripeEmbeddedForm clientSecret={pendingOrgRequest.ClientSecret} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
