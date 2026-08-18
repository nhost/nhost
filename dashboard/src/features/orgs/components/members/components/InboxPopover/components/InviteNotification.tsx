import { formatDistance } from 'date-fns';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/v3/button';
import NotificationCard from '@/features/orgs/components/members/components/InboxPopover/components/NotificationCard';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  type OrganizationMemberInvitesQuery,
  useDeleteOrganizationMemberInviteMutation,
  useOrganizationMemberInviteAcceptMutation,
} from '@/generated/graphql';

export interface InviteNotificationProps {
  invite: OrganizationMemberInvitesQuery['organizationMemberInvites'][number];
}

export default function InviteNotification({
  invite,
}: InviteNotificationProps) {
  const { push } = useRouter();
  const { refetch: refetchOrgs } = useOrgs();

  const [acceptInvite] = useOrganizationMemberInviteAcceptMutation({
    refetchQueries: ['organizationMemberInvites'],
    awaitRefetchQueries: true,
  });
  const [deleteInvite] = useDeleteOrganizationMemberInviteMutation({
    refetchQueries: ['organizationMemberInvites'],
    awaitRefetchQueries: true,
  });

  const handleAccept = () =>
    execPromiseWithErrorToast(
      async () => {
        await acceptInvite({ variables: { inviteId: invite.id } });
        await refetchOrgs();
        await push(`/orgs/${invite.organization.slug}/projects`);
      },
      {
        loadingMessage: 'Accepting invite...',
        successMessage: 'Invite accepted.',
        errorMessage: 'Failed to accept invite! Please try again',
      },
    );

  const handleIgnore = () =>
    execPromiseWithErrorToast(
      async () => {
        await deleteInvite({ variables: { inviteId: invite.id } });
      },
      {
        loadingMessage: 'Processing...',
        successMessage: 'Invite ignored.',
        errorMessage: 'Failed to ignore invite! Please try again',
      },
    );

  return (
    <NotificationCard
      label="Invitation"
      timestamp={formatDistance(new Date(invite.createdAt), new Date(), {
        addSuffix: true,
      })}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={handleIgnore}>
            Ignore
          </Button>
          <Button size="sm" onClick={handleAccept}>
            Accept
          </Button>
        </>
      }
    >
      You have been invited to{' '}
      <span className="font-medium">{invite.organization.name}</span>
    </NotificationCard>
  );
}
