import { usePendingOrganizationRequest } from '@/features/orgs/components/members/hooks/usePendingOrganizationRequest';
import {
  useGetAnnouncementsQuery,
  useOrganizationMemberInvitesQuery,
} from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { isNotEmptyValue } from '@/lib/utils';
import { useAuth } from '@/providers/Auth';

export default function useHasUnreadNotification(): boolean {
  const userData = useUserData();
  const { isAuthenticated } = useAuth();
  const hasUserId = isNotEmptyValue(userData?.id);

  const { data: invitesData } = useOrganizationMemberInvitesQuery({
    variables: {
      userId: userData?.id ?? '',
    },
    skip: !hasUserId,
  });

  const { data: announcementsData } = useGetAnnouncementsQuery({
    skip: !isAuthenticated,
  });

  const pendingOrganizationRequest = usePendingOrganizationRequest();

  const hasPendingInvites =
    (invitesData?.organizationMemberInvites.length ?? 0) > 0;
  const hasUnreadAnnouncements =
    announcementsData?.announcements.some(
      (announcement) => announcement.read.length === 0,
    ) ?? false;
  const hasPendingOrganizationRequest = isNotEmptyValue(
    pendingOrganizationRequest,
  );

  return (
    hasPendingInvites || hasUnreadAnnouncements || hasPendingOrganizationRequest
  );
}
