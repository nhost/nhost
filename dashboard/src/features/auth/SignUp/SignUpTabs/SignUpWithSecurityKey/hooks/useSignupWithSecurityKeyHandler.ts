import { getAnonId } from '@/lib/segment';
import { isEmptyValue } from '@/lib/utils';
import { useNhostClient } from '@/providers/nhost';
import { getToastStyleProps } from '@/utils/constants/settings';
import { startRegistration } from '@simplewebauthn/browser';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import type { SignUpWithSecurityKeyFormValues } from './useSignupWithSecurityKeyForm';

function useOnSignUpWithSecurityKeyHandler() {
  const router = useRouter();
  const nhost = useNhostClient();

  async function onSignUpWithSecurityKey({
    email,
    displayName,
    turnstileToken,
  }: SignUpWithSecurityKeyFormValues) {
    const metadata = { anonId: await getAnonId() };
    try {
      const webAuthnResponse = await nhost.auth.signUpWebauthn(
        {
          email,
          options: {
            displayName,
            metadata,
          },
        },
        {
          headers: {
            'x-cf-turnstile-response': turnstileToken,
          },
        },
      );
      const { body: webAuthnOptions } = webAuthnResponse;

      const credential = await startRegistration(webAuthnOptions);

      const verifyResponse = await nhost.auth.verifySignUpWebauthn({
        credential,
        options: {
          displayName,
          metadata,
        },
      });
      if (verifyResponse.status === 200 && isEmptyValue(verifyResponse.body)) {
        router.push(`/email/verify?email=${encodeURIComponent(email)}`);
      }
    } catch (error) {
      toast.error(
        error.message ||
          'An error occurred while signing up. Please try again.',
        getToastStyleProps(),
      );
    }
  }

  return onSignUpWithSecurityKey;
}

export default useOnSignUpWithSecurityKeyHandler;
