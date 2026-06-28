import type { SignUpOptions } from '@nhost/nhost-js/auth';
import { startRegistration } from '@simplewebauthn/browser';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { appendPkceId, generateAndStorePKCE } from '@/lib/pkce';
import { getAnonId } from '@/lib/segment';
import { isEmptyValue } from '@/lib/utils';
import { useNhostClient } from '@/providers/nhost';
import { getToastStyleProps } from '@/utils/constants/settings';
import type { SignUpWithSecurityKeyFormValues } from './useSignupWithSecurityKeyForm';

function useOnSignUpWithSecurityKeyHandler() {
  const router = useRouter();
  const nhost = useNhostClient();

  async function onSignUpWithSecurityKey({
    email,
    displayName,
    turnstileToken,
  }: SignUpWithSecurityKeyFormValues) {
    try {
      const { challenge, id } = await generateAndStorePKCE();

      const options: SignUpOptions = {
        displayName,
        redirectTo: appendPkceId(window.location.origin, id),
      };

      const anonId = await getAnonId();
      if (anonId) {
        options.metadata = { anonId };
      }

      const webAuthnResponse = await nhost.auth.signUpWebauthn(
        {
          email,
          options,
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
        options,
        codeChallenge: challenge,
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
