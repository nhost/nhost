import { usePendingOrganizationRequest } from '@/features/orgs/components/members/hooks/usePendingOrganizationRequest';
import {
  type GetAnnouncementsQuery,
  type OrganizationMemberInvitesQuery,
  type PostOrganizationRequestResponse,
  useGetAnnouncementsQuery,
  useOrganizationMemberInvitesQuery,
} from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { isNotEmptyValue } from '@/lib/utils';
import { useAuth } from '@/providers/Auth';

export interface InboxState {
  invites: OrganizationMemberInvitesQuery['organizationMemberInvites'];
  invitesLoading: boolean;
  announcements: GetAnnouncementsQuery['announcements'];
  announcementsLoading: boolean;
  pendingOrganizationRequest: PostOrganizationRequestResponse | null;
  hasUnread: boolean;
}

/**
 * One subscriber per page: `usePendingOrganizationRequest` posts the pending
 * request from an effect, so a second caller would post it twice.
 */
export default function useInbox(): InboxState {
  const userData = useUserData();
  const { isAuthenticated } = useAuth();
  const hasUserId = isNotEmptyValue(userData?.id);

  const { data: invitesData, loading: invitesLoading } =
    useOrganizationMemberInvitesQuery({
      variables: {
        userId: userData?.id ?? '',
      },
      skip: !hasUserId,
    });

  const { data: announcementsData, loading: announcementsLoading } =
    useGetAnnouncementsQuery({
      skip: !isAuthenticated,
    });

  const pendingOrganizationRequest = usePendingOrganizationRequest();
  const invites = invitesData?.organizationMemberInvites ?? [];
  const announcements = announcementsData?.announcements ?? [];
  const hasUnread =
    invites.length > 0 ||
    announcements.some((announcement) => announcement.read.length === 0) ||
    isNotEmptyValue(pendingOrganizationRequest);

  return {
    invites,
    invitesLoading,
    announcements,
    announcementsLoading,
    pendingOrganizationRequest,
    hasUnread,
  };
}
