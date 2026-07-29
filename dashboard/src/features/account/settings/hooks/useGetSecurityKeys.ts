import { useSecurityKeysQuery } from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';

function useGetSecurityKeys() {
  const user = useUserData();
  const query = useSecurityKeysQuery({
    variables: {
      userId: user?.id,
    },
  });

  return query;
}

export default useGetSecurityKeys;
