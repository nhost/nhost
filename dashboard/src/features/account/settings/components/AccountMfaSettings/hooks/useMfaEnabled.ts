import { useUserData } from '@/hooks/useUserData';
import { isNotEmptyValue } from '@/lib/utils';
import { useGetActiveMfaTypeQuery } from '@/utils/__generated__/graphql';

function useMfaEnabled() {
  const userData = useUserData();
  const { data, loading, refetch } = useGetActiveMfaTypeQuery({
    variables: { id: userData?.id },
    fetchPolicy: 'cache-first',
  });

  const isMfaEnabled = isNotEmptyValue(data?.user.activeMfaType);

  return { loading, isMfaEnabled, refetch };
}

export default useMfaEnabled;
