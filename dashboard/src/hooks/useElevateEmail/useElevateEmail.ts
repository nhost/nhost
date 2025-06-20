import { useUserData } from '@/hooks/useUserData';
import { isNotEmptyValue } from '@/lib/utils';
import { useNhostClient } from '@/providers/nhost';
import { startAuthentication } from '@simplewebauthn/browser';

function useElevateEmail() {
  const nhost = useNhostClient();
  const user = useUserData();

  async function elevateEmail() {
    const elevateResponse = await nhost.auth.elevateWebauthn();
    const credential = await startAuthentication(elevateResponse.body);
    const verifyResponse = await nhost.auth.verifyElevateWebauthn({
      email: user?.email,
      credential,
    });

    if (isNotEmptyValue(verifyResponse.body.session)) {
      nhost.sessionStorage.set(verifyResponse.body.session);
    }
  }

  return elevateEmail;
}

export default useElevateEmail;
