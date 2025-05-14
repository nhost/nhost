import { isNotEmptyValue } from '@/lib/utils';
import { useGetActiveMfaTypeQuery } from '@/utils/__generated__/graphql';
import { useUserId } from '@nhost/nextjs';

function useMfaEnabled() {
  const userId = useUserId();
  const { data, loading, refetch } = useGetActiveMfaTypeQuery({
    variables: { id: userId },
    fetchPolicy: 'cache-first',
  });

  const isMfaEnabled = isNotEmptyValue(data?.user.activeMfaType);

  return { loading, isMfaEnabled, refetch };
}

export default useMfaEnabled;
