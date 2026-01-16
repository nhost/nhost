'use client';

import type { PublicKeyCredentialCreationOptions } from '@nhost/nhost-js/auth';
import { startRegistration } from '@simplewebauthn/browser';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { isWebAuthnSupported } from '../lib/utils';
import { signUpWebauthn, verifySignUpWebauthn } from '../signup/actions';

interface WebAuthnSignUpFormProps {
  buttonLabel?: string;
}

export default function WebAuthnSignUpForm({
  buttonLabel = 'Register with Security Key',
}: WebAuthnSignUpFormProps) {
  const [email, setEmail] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [keyNickname, setKeyNickname] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [challengeData, setChallengeData] =
    useState<PublicKeyCredentialCreationOptions | null>(null);
  const router = useRouter();

  /**
   * Handles the WebAuthn registration flow (sign up with security key/biometrics)
   *
   * The WebAuthn registration flow consists of:
   * 1. Server generates a challenge and user verification requirements
   * 2. Browser activates the authenticator and creates new credential key pair
   * 3. The private key remains securely on the user's device
   * 4. The public key and attestation are sent to the server for verification
   * 5. Server stores the public key for future authentication attempts
   */
  const startWebAuthnRegistration = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validate required fields
    if (!email) {
      setError('Email is required');
      setIsLoading(false);
      return;
    }

    // Check browser compatibility before proceeding
    if (!isWebAuthnSupported()) {
      setError('WebAuthn is not supported by your browser.');
      setIsLoading(false);
      return;
    }

    try {
      // Step 1: Request a registration challenge from the server
      const result = await signUpWebauthn({
        email,
        displayName: displayName || undefined,
      });

      if (result.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      if (!result.publicKeyCredentialCreationOptions) {
        setError('Failed to get registration challenge from server');
        setIsLoading(false);
        return;
      }

      // Store the challenge data for UI feedback
      setChallengeData(result.publicKeyCredentialCreationOptions);

      try {
        // Step 2: Browser prompts user to create a new credential
        const credential = await startRegistration({
          optionsJSON: result.publicKeyCredentialCreationOptions,
        });

        if (!credential) {
          setError('No credential was created.');
          setIsLoading(false);
          return;
        }

        // Step 3: Send the credential attestation to the server for verification
        // Use PublicKeyCredential's built-in serialization method
        const verifyResult = await verifySignUpWebauthn(
          credential,
          keyNickname || `Security Key for ${displayName || email}`,
        );

        if (verifyResult.error) {
          setError(verifyResult.error);
          return;
        }

        if (verifyResult.redirect) {
          router.push(verifyResult.redirect);
        } else {
          setError('Registration failed: No redirect URL returned');
        }
      } catch (credError) {
        setError(
          `WebAuthn registration failed: ${(credError as Error).message || 'Unknown error'}`,
        );
      }
    } catch (err) {
      setError(
        `An error occurred during WebAuthn sign up: ${(err as Error).message || 'Unknown error'}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={startWebAuthnRegistration} className="space-y-5">
      <div>
        <label htmlFor={useId()}>Display Name</label>
        <input
          id={useId()}
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor={useId()}>Email</label>
        <input
          id={useId()}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor={useId()}>Key Nickname (Optional)</label>
        <input
          id={useId()}
          type="text"
          value={keyNickname}
          onChange={(e) => setKeyNickname(e.target.value)}
          placeholder="My Security Key"
        />
        <p className="text-xs mt-1 text-gray-400">
          A friendly name for your security key
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <button
        type="submit"
        className="btn btn-primary w-full"
        disabled={isLoading || !email}
      >
        {isLoading
          ? challengeData
            ? 'Complete Registration on Your Device...'
            : 'Initializing...'
          : buttonLabel}
      </button>

      <div className="text-xs mt-2 text-gray-400">
        <p>
          You&apos;ll be prompted to use your device&apos;s security key (like
          TouchID, FaceID, Windows Hello, or a USB security key)
        </p>
        <p className="mt-1">
          When prompted, please complete the biometric verification or insert
          and activate your security key to create your account.
        </p>
      </div>
    </form>
  );
}
