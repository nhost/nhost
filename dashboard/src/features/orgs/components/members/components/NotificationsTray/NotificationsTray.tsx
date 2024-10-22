import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/v3/sheet';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useDeleteOrganizationMemberInviteMutation,
  useOrganizationMemberInviteAcceptMutation,
  useOrganizationMemberInvitesLazyQuery,
} from '@/utils/__generated__/graphql';
import { useUserData } from '@nhost/nextjs';
import { formatDistance } from 'date-fns';
import { Bell } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function NotificationsTray() {
  const { refetch: refetchOrgs } = useOrgs();
  const { asPath } = useRouter();
  const userData = useUserData();
  const { asPath, route } = useRouter();
  const { refetch: refetchOrgs } = useOrgs();

  const [stripeFormDialogOpen, setStripeFormDialogOpen] = useState(false);

  const [pendingOrgRequest, setPendingOrgRequest] =
    useState<PostOrganizationRequestResponse | null>(null);

  const [
    getInvites,
    {
      data: { organizationMemberInvites: invites = [] } = {},
      refetch: refetchInvites,
    },
  ] = useOrganizationMemberInvitesLazyQuery();

  useEffect(() => {
    if (userData) {
      getInvites({
        variables: {
          userId: userData.id,
        },
      });
    }
  }, [asPath, userData, getInvites]);

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
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" className="relative h-fit px-3 py-1">
          <Bell className="mt-[2px] h-[1.15rem] w-[1.15rem]" />
          {invites.length > 0 && (
            <div className="absolute right-3 top-2 h-2 w-2 rounded-full bg-red-500" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="h-full w-full bg-background p-0 text-foreground sm:max-w-[310px]">
        <SheetHeader>
          <SheetTitle className="sr-only">Notifications</SheetTitle>
          <SheetDescription className="sr-only">
            List of pending invites and create organization requests
          </SheetDescription>
        </SheetHeader>
        <div className="flex h-full w-full flex-col">
          <div className="flex h-12 items-center border-b px-2">
            <h3 className="font-medium">
              Notifications {invites.length > 0 && `(${invites.length})`}
            </h3>
          </div>

          <div className="p-2">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-col gap-2 rounded-md border p-2"
              >
                <div className="flex flex-col items-end gap-2">
                  <div className="flex w-full items-center justify-between">
                    <Badge className="h-5 px-[6px] text-[10px]">
                      Invitation
                    </Badge>
                    <span className="text-xs">
                      {formatDistance(new Date(invite.createdAt), new Date(), {
                        addSuffix: true,
                      })}
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
  );
}
