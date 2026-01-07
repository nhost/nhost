'use client';

import type { PublicKeyCredentialRequestOptions } from '@nhost/nhost-js/auth';
import { startAuthentication } from '@simplewebauthn/browser';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { isWebAuthnSupported } from '../lib/utils';
import { signInWebauthn, verifySignInWebauthn } from '../signin/actions';

interface WebAuthnSignInFormProps {
  buttonLabel?: string;
}

export default function WebAuthnSignInForm({
  buttonLabel = 'Sign In with Security Key',
}: WebAuthnSignInFormProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [challengeData, setChallengeData] =
    useState<PublicKeyCredentialRequestOptions | null>(null);
  const router = useRouter();

  /**
   * Handles the WebAuthn authentication flow:
   * 1. Request a challenge from the server
   * 2. Have the browser/authenticator sign the challenge with the private key
   * 3. Verify the signature on the server and establish a session
   */
  const startWebAuthnSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Check if WebAuthn is supported on this browser
      if (!isWebAuthnSupported()) {
        setError('WebAuthn is not supported by your browser.');
        setIsLoading(false);
        return;
      }

      // Step 1: Request a challenge from the server for credential discovery
      const result = await signInWebauthn();

      if (result.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      if (!result.publicKeyCredentialRequestOptions) {
        setError('Failed to get authentication challenge from server');
        setIsLoading(false);
        return;
      }

      setChallengeData(result.publicKeyCredentialRequestOptions);

      try {
        // Step 2: Browser prompts user for their security key or biometric verification
        const credential = await startAuthentication({
          optionsJSON: result.publicKeyCredentialRequestOptions,
        });

        if (!credential) {
          setError('No credential was selected.');
          setIsLoading(false);
          return;
        }

        // Step 3: Send the signed challenge to the server for verification
        // Use PublicKeyCredential's built-in serialization method
        const verifyResult = await verifySignInWebauthn(credential);

        if (verifyResult.error) {
          setError(verifyResult.error);
          return;
        }

        if (verifyResult.redirect) {
          router.push(verifyResult.redirect);
        } else {
          setError('Authentication failed: No redirect URL returned');
        }
      } catch (credError) {
        setError(
          `WebAuthn authentication failed: ${(credError as Error).message || 'Unknown error'}`,
        );
      }
    } catch (err) {
      setError(
        `An error occurred during WebAuthn sign in: ${(err as Error).message || 'Unknown error'}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={startWebAuthnSignIn} className="space-y-5">
      {error && <div className="alert alert-error">{error}</div>}

      <button
        type="submit"
        className="btn btn-primary w-full"
        disabled={isLoading}
      >
        {isLoading
          ? challengeData
            ? 'Authenticating with your device...'
            : 'Initializing...'
          : buttonLabel}
      </button>

      <div className="text-xs mt-2 text-gray-400">
        <p>
          You&apos;ll be prompted to use your device&apos;s security key (like
          TouchID, FaceID, Windows Hello, or a USB security key)
        </p>
        <p>
          Your browser will show available security keys that you&apos;ve
          previously registered.
        </p>
      </div>
    </form>
  );
}
