import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/v3/sheet';
import { StripeEmbeddedForm } from '@/features/orgs/components/StripeEmbeddedForm';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  CheckoutStatus,
  useDeleteOrganizationMemberInviteMutation,
  useOrganizationMemberInviteAcceptMutation,
  useOrganizationMemberInvitesLazyQuery,
  useOrganizationNewRequestsLazyQuery,
  usePostOrganizationRequestMutation,
  type PostOrganizationRequestResponse,
} from '@/utils/__generated__/graphql';
import { useUserData } from '@nhost/nextjs';
import { formatDistance } from 'date-fns';
import { Bell } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function NotificationsTray() {
  const { refetch: refetchOrgs } = useOrgs();
  const { asPath, route } = useRouter();
  const userData = useUserData();
  const [
    getInvites,
    {
      loading,
      refetch: refetchInvites,
      data: { organizationMemberInvites: invites = [] } = {},
    },
  ] = useOrganizationMemberInvitesLazyQuery();

  const [stripeFormDialogOpen, setStripeFormDialogOpen] = useState(false);

  const [pendingOrgRequest, setPendingOrgRequest] =
    useState<PostOrganizationRequestResponse | null>(null);
  const [getOrganizationNewRequests] = useOrganizationNewRequestsLazyQuery();
  const [postOrganizationRequest] = usePostOrganizationRequestMutation();

  useEffect(() => {
    if (userData) {
      getInvites({
        variables: {
          userId: userData.id,
        },
      });
    }
  }, [asPath, userData, getInvites]);

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
            break;

          case CheckoutStatus.Completed:
            // Do nothing
            break;

          case CheckoutStatus.Expired:
            // Do nothing
            break;

          default:
            break;
        }
      }
    };

    if (userData && !['/', '/orgs/verify'].includes(route)) {
      checkForPendingOrgRequests();
    }
  }, [route, userData, getOrganizationNewRequests, postOrganizationRequest]);

  const [acceptInvite] = useOrganizationMemberInviteAcceptMutation();
  const [deleteInvite] = useDeleteOrganizationMemberInviteMutation();

  const handleAccept = async (inviteId: string) => {
    await execPromiseWithErrorToast(
      async () => {
        await acceptInvite({
          variables: {
            inviteId,
          },
        });

        refetchInvites();
        refetchOrgs();
      },
      {
        loadingMessage: `Accepting invite...`,
        successMessage: `Invite accepted.`,
        errorMessage: `Failed to accept invite! Please try again`,
      },
    );
  };

  const handleIgnore = async (inviteId: string) => {
    await execPromiseWithErrorToast(
      async () => {
        await deleteInvite({
          variables: {
            inviteId,
          },
        });

        refetchInvites();
      },
      {
        loadingMessage: `Processing...`,
        successMessage: `Invite ignored.`,
        errorMessage: `Failed to ignore invite! Please try again`,
      },
    );
  };

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" className="relative px-3 py-1 h-fit">
            <Bell className="mt-[2px] h-[1.15rem] w-[1.15rem]" />
            {invites.length > 0 ||
              (pendingOrgRequest && (
                <div className="absolute w-2 h-2 bg-red-500 rounded-full right-3 top-2" />
              ))}
          </Button>
        </SheetTrigger>
        <SheetContent className="h-full w-full bg-background p-0 text-foreground sm:max-w-[310px]">
          <SheetHeader>
            <SheetTitle className="sr-only">Notifications</SheetTitle>
            <SheetDescription className="sr-only">
              List of pending invites and create organization requests
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col w-full h-full">
            <div className="flex items-center h-12 px-2 border-b">
              <h3 className="font-medium">
                Notifications {invites.length > 0 && `(${invites.length})`}
              </h3>
            </div>

            <div className="p-2">
              {!loading && invites.length === 0 && !pendingOrgRequest && (
                <span className="text-muted-foreground">
                  No new notifications
                </span>
              )}

              {pendingOrgRequest && (
                <div className="flex flex-col gap-2 p-2 border rounded-md">
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center justify-between w-full">
                      <Badge className="h-5 px-[6px] text-[10px]">
                        New Organization pending
                      </Badge>
                    </div>
                    <p className="w-full">
                      You have previously tried to create a new organization
                    </p>
                  </div>
                  <div className="flex flex-row justify-end gap-2">
                    <Button
                      className="h-fit"
                      onClick={async () => {
                        setStripeFormDialogOpen(true);
                      }}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-2 p-2 border rounded-md"
                >
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center justify-between w-full">
                      <Badge className="h-5 px-[6px] text-[10px]">
                        Invitation
                      </Badge>
                      <span className="text-xs">
                        {formatDistance(
                          new Date(invite.createdAt),
                          new Date(),
                          {
                            addSuffix: true,
                          },
                        )}
                      </span>
                    </div>
                    <p className="w-full">
                      You have been invited to Organization{' '}
                      <span className="font-medium">
                        {invite.organization.name}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-row justify-end gap-2">
                    <Button
                      variant="outline"
                      className="h-fit"
                      onClick={() => {
                        handleIgnore(invite.id);
                      }}
                    >
                      Ignore
                    </Button>
                    <Button
                      className="h-fit"
                      onClick={() => handleAccept(invite.id)}
                    >
                      Accept
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

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
