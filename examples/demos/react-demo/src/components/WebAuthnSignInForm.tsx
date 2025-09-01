import { useState, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/nhost/AuthProvider";
import { type ErrorResponse } from "@nhost/nhost-js/auth";
import { type FetchError } from "@nhost/nhost-js/fetch";
import { isWebAuthnSupported } from "../lib/utils";
import { startAuthentication } from "@simplewebauthn/browser";

/**
 * WebAuthnSignInForm provides a passwordless authentication flow using WebAuthn (FIDO2) protocol.
 * This enables users to authenticate using biometrics, hardware security keys, or platform authenticators
 * instead of traditional passwords.
 */
export default function WebAuthnSignInForm(): JSX.Element {
  const { nhost } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handles the WebAuthn authentication flow:
   * 1. Request a challenge from the server
   * 2. Have the browser/authenticator sign the challenge with the private key
   * 3. Verify the signature on the server and establish a session
   */
  const startWebAuthnSignIn = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // First check if WebAuthn is supported by this browser
      if (!isWebAuthnSupported()) {
        setError("WebAuthn is not supported by your browser.");
        setIsLoading(false);
        return;
      }

      // Step 1: Request a challenge from the server for credential discovery
      // The server creates a random challenge and sends allowed credential information
      // This prevents replay attacks by ensuring each authentication attempt is unique
      const response = await nhost.auth.signInWebauthn();

      try {
        // Step 2: Browser prompts user for their security key or biometric verification
        // The navigator.credentials.get() API activates the authenticator (fingerprint reader,
        // security key, etc.) and asks the user to verify their identity
        // The authenticator then signs the challenge with the private key
        const credential = await startAuthentication({
          optionsJSON: response.body,
        });

        if (!credential) {
          setError("No credential was selected.");
          setIsLoading(false);
          return;
        }

        // Step 3: Send the signed challenge to the server for verification
        // The server validates the signature using the stored public key
        // If valid, the server creates an authenticated session
        const verifyResponse = await nhost.auth.verifySignInWebauthn({
          credential,
        });

        // Step 4: Handle authentication result
        if (verifyResponse.body && verifyResponse.body.session) {
          // Authentication successful, redirect to profile page
          navigate("/profile");
        } else {
          setError("Authentication failed");
        }
      } catch (credError) {
        setError(
          `WebAuthn authentication failed: ${(credError as Error).message || "Unknown error"}`,
        );
      }
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(`An error occurred during WebAuthn sign in: ${error.message}`);
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
        {isLoading ? "Authenticating..." : "Sign In with Security Key"}
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
