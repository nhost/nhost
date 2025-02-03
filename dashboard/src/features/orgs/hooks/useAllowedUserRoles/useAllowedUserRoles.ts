import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { getUserRoles } from '@/features/orgs/projects/roles/settings/utils/getUserRoles';
import { useGetRemoteAppAllowedRolesQuery } from '@/utils/__generated__/graphql';
import { useMemo } from 'react';

function useAllowedUserRoles() {
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();
  const { data } = useGetRemoteAppAllowedRolesQuery({
    client: remoteProjectGQLClient,
  });
  const authRoles = (data?.authRoles || []).map((authRole) => authRole.role);
  const allowedRoles = useMemo(() => getUserRoles(authRoles), [authRoles]);

  return allowedRoles;
}

export default useAllowedUserRoles;
