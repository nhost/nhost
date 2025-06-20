import useUserData from '@/hooks/sdk/useUserData';
import { useSecurityKeysQuery } from '@/utils/__generated__/graphql';

function useGetSecurityKeys() {
  const { id } = useUserData();
  const query = useSecurityKeysQuery({
    variables: {
      userId: id,
    },
  });

  return query;
}

export default useGetSecurityKeys;
