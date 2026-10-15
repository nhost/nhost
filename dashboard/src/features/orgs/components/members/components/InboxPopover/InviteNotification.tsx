import { linkOptions, useNavigate, useRouter } from '@tanstack/react-router';
import { formatDistance } from 'date-fns';
import { Button } from '@/components/ui/v3/button';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  type OrganizationMemberInvitesQuery,
  useDeleteOrganizationMemberInviteMutation,
  useOrganizationMemberInviteAcceptMutation,
} from '@/generated/graphql';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import NotificationCard from './NotificationCard';

interface InviteNotificationProps {
  invite: OrganizationMemberInvitesQuery['organizationMemberInvites'][number];
  onAccepted: VoidFunction;
}

export default function InviteNotification({
  invite,
  onAccepted,
}: InviteNotificationProps) {
  const navigate = useNavigate();
  const router = useRouter();
  const { refetch: refetchOrgs } = useOrgs();
  const track = useTrackEvent();

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
        track('Organization Invite Accepted', {
          org_slug: invite.organization.slug,
        });
        await refetchOrgs();
        const target = linkOptions({
          to: '/orgs/$orgSlug/projects',
          params: { orgSlug: invite.organization.slug },
        });
        await navigate(target);
        // A blocker (e.g. unsaved changes) can keep the user on the page.
        if (
          router.state.location.pathname ===
          router.buildLocation(target).pathname
        ) {
          onAccepted();
        }
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
