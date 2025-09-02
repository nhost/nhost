<script lang="ts">
import type {
  ErrorResponse,
  PublicKeyCredentialCreationOptions,
} from "@nhost/nhost-js/auth";
import type { FetchError } from "@nhost/nhost-js/fetch";
import { startRegistration } from "@simplewebauthn/browser";
import { nhost } from "$lib/nhost/auth";
import { isWebAuthnSupported } from "$lib/utils";

interface Props {
  email: string;
  setEmail: (email: string) => void;
  displayName: string;
  setDisplayName: (name: string) => void;
  redirectTo?: string;
}

let { email, setEmail, displayName, setDisplayName, redirectTo }: Props =
  $props();

let isLoading = $state(false);
let error = $state<string | null>(null);
let keyNickname = $state("");
let challengeData = $state<PublicKeyCredentialCreationOptions | null>(null);

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
async function startWebAuthnRegistration(e: Event) {
  e.preventDefault();
  isLoading = true;
  error = null;

  // Validate required fields
  if (!email) {
    error = "Email is required";
    isLoading = false;
    return;
  }

  // Check browser compatibility before proceeding
  if (!isWebAuthnSupported()) {
    error = "WebAuthn is not supported by your browser.";
    isLoading = false;
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
    challengeData = response.body;

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
        error = "No credential was created.";
        isLoading = false;
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
      error = `WebAuthn registration failed: ${(credError as Error).message || "Unknown error"}`;
    }
  } catch (err) {
    const fetchError = err as FetchError<ErrorResponse>;
    error = `An error occurred during WebAuthn sign up: ${fetchError.message}`;
  } finally {
    isLoading = false;
  }
}
</script>

<form onsubmit={startWebAuthnRegistration} class="space-y-5">
  <div>
    <label for="webauthnDisplayName">Display Name</label>
    <input
      id="webauthnDisplayName"
      type="text"
      bind:value={displayName}
      oninput={(e) => setDisplayName(e.currentTarget.value)}
    />
  </div>

  <div>
    <label for="webauthnEmail">Email</label>
    <input
      id="webauthnEmail"
      type="email"
      bind:value={email}
      oninput={(e) => setEmail(e.currentTarget.value)}
      required
    />
  </div>

  <div>
    <label for="keyNickname">Key Nickname (Optional)</label>
    <input
      id="keyNickname"
      type="text"
      bind:value={keyNickname}
      placeholder="My Security Key"
    />
    <p class="text-xs mt-1" style="color: var(--text-muted)">
      A friendly name for your security key
    </p>
  </div>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  <button
    type="submit"
    class="btn btn-primary w-full"
    disabled={isLoading || !email}
  >
    {isLoading
      ? challengeData
        ? "Complete Registration on Your Device..."
        : "Initializing..."
      : "Register with Security Key"}
  </button>

  <div class="text-xs mt-2" style="color: var(--text-muted)">
    <p>
      You'll be prompted to use your device's security key (like TouchID,
      FaceID, Windows Hello, or a USB security key)
    </p>
    <p class="mt-1">
      When prompted, please complete the biometric verification or insert and
      activate your security key to create your account.
    </p>
  </div>
</form>
