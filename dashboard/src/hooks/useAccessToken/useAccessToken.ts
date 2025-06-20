import { useAuth } from '@/providers/Auth';

function useAccessToken() {
  const { session } = useAuth();

  return session?.accessToken;
}

export default useAccessToken;
