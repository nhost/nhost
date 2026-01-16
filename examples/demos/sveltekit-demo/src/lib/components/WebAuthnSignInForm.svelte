<script lang="ts">
import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { startAuthentication } from '@simplewebauthn/browser';
import { goto } from '$app/navigation';
import { nhost } from '$lib/nhost/auth';
import { isWebAuthnSupported } from '$lib/utils';

let isLoading = false;
let error: string | null = null;

/**
 * Handles the WebAuthn authentication flow:
 * 1. Request a challenge from the server
 * 2. Have the browser/authenticator sign the challenge with the private key
 * 3. Verify the signature on the server and establish a session
 */
async function startWebAuthnSignIn(e: Event) {
  e.preventDefault();
  isLoading = true;
  error = null;

  try {
    // First check if WebAuthn is supported by this browser
    if (!isWebAuthnSupported()) {
      error = 'WebAuthn is not supported by your browser.';
      isLoading = false;
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
        error = 'No credential was selected.';
        isLoading = false;
        return;
      }

      // Step 3: Send the signed challenge to the server for verification
      // The server validates the signature using the stored public key
      // If valid, the server creates an authenticated session
      const verifyResponse = await nhost.auth.verifySignInWebauthn({
        credential,
      });

      // Step 4: Handle authentication result
      if (verifyResponse.body?.session) {
        // Authentication successful, redirect to profile page
        void goto('/profile');
      } else {
        error = 'Authentication failed';
      }
    } catch (credError) {
      error = `WebAuthn authentication failed: ${(credError as Error).message || 'Unknown error'}`;
    }
  } catch (err) {
    const fetchError = err as FetchError<ErrorResponse>;
    error = `An error occurred during WebAuthn sign in: ${fetchError.message}`;
  } finally {
    isLoading = false;
  }
}
</script>

<form onsubmit={startWebAuthnSignIn} class="space-y-5">
  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  <button type="submit" class="btn btn-primary w-full" disabled={isLoading}>
    {isLoading ? "Authenticating..." : "Sign In with Security Key"}
  </button>

  <div class="text-xs mt-2" style="color: var(--text-muted)">
    <p>
      You'll be prompted to use your device's security key (like TouchID,
      FaceID, Windows Hello, or a USB security key)
    </p>
    <p>
      Your browser will show available security keys that you've previously
      registered.
    </p>
  </div>
</form>
