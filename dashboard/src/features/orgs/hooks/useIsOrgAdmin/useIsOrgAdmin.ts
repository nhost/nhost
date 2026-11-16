import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { Organization_Members_Role_Enum } from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';

export default function useIsOrgAdmin() {
  const { org: { members = [] } = {} } = useCurrentOrg();
  const { id } = useUserData() || {};

  return Boolean(
    members.find(
      (member) =>
        member.user.id === id &&
        member.role === Organization_Members_Role_Enum.Admin,
    ),
  );
}
