import { startAuthentication } from '@simplewebauthn/browser';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { isNotEmptyValue } from '@/lib/utils';
import { useNhostClient } from '@/providers/nhost';
import { getToastStyleProps } from '@/utils/constants/settings';

interface Props {
  onNeedsEmailVerification: () => void;
}

function useSignInWithSecurityKey({ onNeedsEmailVerification }: Props) {
  const nhost = useNhostClient();
  const [disabled, setDisabled] = useState(false);

  async function signInWithSecurityKey() {
    try {
      setDisabled(true);
      const signInWebauthnResponse = await nhost.auth.signInWebauthn();
      const { body: options } = signInWebauthnResponse;
      const credential = await startAuthentication(options);
      await nhost.auth.verifySignInWebauthn({
        credential,
      });
    } catch (error) {
      let errorMessage =
        error?.message ||
        'An error occurred while signing in. Please try again.';

      if (isNotEmptyValue(error?.body)) {
        const errorCode = error.body.error;
        if (errorCode === 'unverified-user') {
          onNeedsEmailVerification();
          return;
        }
        errorMessage = error.body.message;
      }
      toast.error(errorMessage, getToastStyleProps());
    } finally {
      setDisabled(false);
    }
  }

  return { disabled, signInWithSecurityKey };
}

export default useSignInWithSecurityKey;
