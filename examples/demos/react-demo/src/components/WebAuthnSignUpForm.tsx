import type {
  ErrorResponse,
  PublicKeyCredentialCreationOptions,
} from "@nhost/nhost-js/auth";
import type { FetchError } from "@nhost/nhost-js/fetch";
import { startRegistration } from "@simplewebauthn/browser";
import { type JSX, useId, useState } from "react";
import { useAuth } from "../lib/nhost/AuthProvider";
import { isWebAuthnSupported } from "../lib/utils";

/**
 * WebAuthn Registration (Sign Up) Flow
 *
 * This component handles new user registration using WebAuthn/FIDO2 standards.
 * Instead of creating a password, users register using biometrics or security keys,
 * providing a more secure and phishing-resistant authentication method.
 */

/**
 * Props for the WebAuthn signup form
 * @param email - User's email address
 * @param setEmail - Function to update email state
 * @param displayName - User's display name
 * @param setDisplayName - Function to update display name state
 * @param redirectTo - Optional URL to redirect after successful registration
 */
interface WebAuthnFormProps {
  email: string;
  setEmail: (email: string) => void;
  displayName: string;
  setDisplayName: (name: string) => void;
  redirectTo?: string;
}

export default function WebAuthnSignUpForm({
  email,
  setEmail,
  displayName,
  setDisplayName,
  redirectTo,
}: WebAuthnFormProps): JSX.Element {
  const { nhost } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [keyNickname, setKeyNickname] = useState<string>("");
  const [challengeData, setChallengeData] =
    useState<PublicKeyCredentialCreationOptions | null>(null);
  const displayNameId = useId();
  const emailId = useId();
  const keyNicknameId = useId();

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
  ): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validate required fields
    if (!email) {
      setError("Email is required");
      setIsLoading(false);
      return;
    }

    // Check browser compatibility before proceeding
    if (!isWebAuthnSupported()) {
      setError("WebAuthn is not supported by your browser.");
      setIsLoading(false);
      return;
    }

    try {
      // Step 1: Request a registration challenge from the server
      // The server generates a random challenge and credential creation options
      // including information like:
      // - relying party (website) details
      // - user account information
      // - challenge to prevent replay attacks
      // - supported algorithms
      const response = await nhost.auth.signUpWebauthn({
        email,
        options: {
          displayName,
        },
      });

      // Store the challenge data for UI feedback
      setChallengeData(response.body);

      try {
        // Step 2: Browser prompts user to create a new credential
        // This activates the authenticator (fingerprint scanner, security key, etc.)
        // and creates a new public/private key pair
        // - The private key is stored securely on the device
        // - The public key will be sent to the server
        const credential = await startRegistration({
          optionsJSON: response.body,
        });

        if (!credential) {
          setError("No credential was created.");
          setIsLoading(false);
          return;
        }

        // Step 3: Send the credential attestation to the server for verification
        // The server verifies the attestation signature and certificate chain,
        // then stores the public key for future authentication attempts
        const verifyResponse = await nhost.auth.verifySignUpWebauthn({
          credential,
          options: {
            displayName: displayName || undefined,
          },
          nickname: keyNickname || `Security Key for ${displayName || email}`,
        });

        // Step 4: Handle registration success
        if (verifyResponse.body?.session) {
          // Success! User is now registered and authenticated
          // At this point:
          // - The user account has been created in the system
          // - The public key is stored in the database
          // - The private key remains securely on the user's device
          // - A session has been established
          window.location.href =
            redirectTo || `${window.location.origin}/profile`;
        }
      } catch (credError) {
        setError(
          `WebAuthn registration failed: ${(credError as Error).message || "Unknown error"}`,
        );
      }
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(`An error occurred during WebAuthn sign up: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={startWebAuthnRegistration} className="space-y-5">
      <div>
        <label htmlFor={displayNameId}>Display Name</label>
        <input
          id={displayNameId}
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor={emailId}>Email</label>
        <input
          id={emailId}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor={keyNicknameId}>Key Nickname (Optional)</label>
        <input
          id={keyNicknameId}
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
            ? "Complete Registration on Your Device..."
            : "Initializing..."
          : "Register with Security Key"}
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
