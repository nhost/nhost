import { useAuth } from '@/providers/Auth';
import type { User } from '@nhost/nhost-js-beta/auth';

function useUserData() {
  const authContext = useAuth();

  const userData = authContext.user || ({} as User);

  return userData;
}

export default useUserData;
