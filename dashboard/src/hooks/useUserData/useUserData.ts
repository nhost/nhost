import { useAuth } from '@/providers/Auth';

function useUserData() {
  const authContext = useAuth();

  const userData = authContext.user;

  return userData;
}

export default useUserData;
