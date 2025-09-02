<script lang="ts">
import { onMount } from "svelte";
import { auth, nhost } from "$lib/nhost/auth";
import { isWebAuthnSupported } from "$lib/utils";
import type { FetchError, FetchResponse } from "@nhost/nhost-js/fetch";
import type { ErrorResponse } from "@nhost/nhost-js/auth";
import { startRegistration } from "@simplewebauthn/browser";

/**
 * Represents a WebAuthn security key stored for a user
 * - id: Database ID for the key
 * - credentialId: WebAuthn credential identifier
 * - nickname: User-provided friendly name for the key
 */
interface SecurityKey {
  id: string;
  credentialId: string;
  nickname: string | null;
}

/**
 * GraphQL response format for security keys query
 */
interface SecurityKeysResponse {
  data?: {
    authUserSecurityKeys: SecurityKey[];
  };
}

let securityKeys = $state<SecurityKey[]>([]);
let isLoading = $state(true);
let isRegistering = $state(false);
let isDeleting = $state(false);
let deletingKeyId = $state<string | null>(null);
let keyName = $state("");
let success = $state<string | null>(null);
let errorMessage = $state<string | null>(null);
let showAddForm = $state(false);
let isWebAuthnAvailable = $state(true);

/**
 * Fetches all registered WebAuthn security keys for the current user
 * These are the public keys stored on the server that correspond to
 * private keys stored securely on the user's devices/authenticators
 */
async function fetchSecurityKeys() {
  if (!$auth.user?.id) return;

  isLoading = true;
  errorMessage = null;

  try {
    // Query the database for all security keys registered to this user
    const response: FetchResponse<SecurityKeysResponse> =
      await nhost.graphql.request({
        query: `
          query GetUserSecurityKeys {
            authUserSecurityKeys {
              id
              credentialId
              nickname
            }
          }
        `,
      });

    const userData = response.body?.data;
    const keys = userData?.authUserSecurityKeys || [];
    securityKeys = keys;
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    errorMessage = `Failed to load security keys: ${error.message}`;
  } finally {
    isLoading = false;
  }
}

async function deleteSecurityKey(keyId: string) {
  if (isDeleting) return;

  isDeleting = true;
  deletingKeyId = keyId;
  success = null;
  errorMessage = null;

  try {
    // Send request to server to delete the security key
    // This removes the stored public key from the server database
    // so it can no longer be used for authentication
    const response = await nhost.graphql.request({
      query: `
          mutation DeleteSecurityKey($keyId: uuid!) {
            deleteAuthUserSecurityKey(id: $keyId) {
              id
            }
          }
        `,
      variables: {
        keyId,
      },
    });

    if (response.body?.errors) {
      throw new Error(response.body.errors[0]?.message || "Unknown error");
    }

    // Update the UI by removing the key from local state
    securityKeys = securityKeys.filter((key) => key.id !== keyId);
    success =
      "Security key deleted successfully! Remember to also remove it from your authenticator app, password manager, or device credential manager to avoid future authentication issues.";

    // Hide success message after 5 seconds (increased to give users time to read the reminder)
    setTimeout(() => {
      success = null;
    }, 5000);
  } catch (err) {
    const error = err as Error;
    errorMessage = `Failed to delete security key: ${error.message}`;
  } finally {
    isDeleting = false;
    deletingKeyId = null;
  }
}

async function registerNewSecurityKey(e: Event) {
  e.preventDefault();

  // Check if browser supports WebAuthn
  if (!isWebAuthnAvailable) {
    errorMessage =
      "WebAuthn is not supported by your browser. Please use a modern browser that supports WebAuthn.";
    return;
  }

  // Validate key name exists
  if (!keyName.trim()) {
    errorMessage = "Please provide a name for your security key";
    return;
  }

  isRegistering = true;
  errorMessage = null;
  success = null;

  try {
    // Step 1: Request challenge from server
    // The server generates a random challenge to ensure the registration
    // is happening in real-time and creates a new credential ID
    const initResponse = await nhost.auth.addSecurityKey();

    // Step 2: Browser prompts user for security key or biometric verification
    // The browser creates a new credential pair (public/private) and stores
    // the private key securely on the device
    const credential = await startRegistration({
      optionsJSON: initResponse.body,
    });

    if (!credential) {
      errorMessage = "No credential was selected. Please try again.";
      return;
    }

    // Step 3: Send credential public key back to server for verification
    // The server verifies the attestation and stores the public key
    // associated with the user's account for future authentication
    await nhost.auth.verifyAddSecurityKey({
      credential,
      nickname: keyName.trim(),
    });

    // Step 4: Registration successful - update UI
    success = "Security key registered successfully!";
    keyName = "";
    showAddForm = false;

    // Refresh the security keys list
    void fetchSecurityKeys();
  } catch (err) {
    const error = err as Error;
    errorMessage = `Failed to register security key: ${error.message}`;
  } finally {
    isRegistering = false;
  }
}

function toggleAddForm() {
  showAddForm = !showAddForm;
  errorMessage = null;
  success = null;
  keyName = "";
}

onMount(() => {
  // Check if the current browser supports WebAuthn
  // This tests for the presence of the WebAuthn API (PublicKeyCredential and credentials)
  isWebAuthnAvailable = isWebAuthnSupported();

  // Load the user's security keys when authenticated
  if ($auth.isAuthenticated && $auth.user?.id) {
    void fetchSecurityKeys();
  }
});
</script>

<div class="glass-card p-8 mb-6">
  <h3 class="text-xl mb-4">Security Keys</h3>

  {#if errorMessage}
    <div class="alert alert-error mb-4">{errorMessage}</div>
  {/if}

  {#if success}
    <div class="alert alert-success mb-4">{success}</div>
  {/if}

  {#if !isWebAuthnAvailable}
    <div class="alert alert-error mb-4">
      <p>
        <strong>WebAuthn not supported!</strong> Your browser or device doesn't support
        WebAuthn authentication. Please use a modern browser (Chrome, Firefox, Safari,
        Edge) that supports WebAuthn.
      </p>
      <p class="mt-2 text-sm">
        Note: Even if your browser supports WebAuthn, you may need a compatible
        authenticator like a fingerprint reader, facial recognition, or a
        security key (e.g., YubiKey).
      </p>
    </div>
  {/if}

  {#if isLoading}
    <p>Loading security keys...</p>
  {:else if showAddForm}
    <div class="space-y-5">
      <p>
        Enter a name for your security key and follow the prompts from your
        browser to register it.
      </p>
      <p class="text-sm mt-2" style="color: var(--text-muted)">
        Note: You'll need a security key (like YubiKey) or a device with
        biometric authentication (like Touch ID, Face ID, or Windows Hello). If
        registration fails, make sure your device has the required capabilities.
      </p>
      <p class="text-sm" style="color: var(--text-muted)">
        This works the same way as when you registered during sign up.
      </p>

      <form onsubmit={registerNewSecurityKey} class="space-y-4">
        <div>
          <label for="keyName" class="block mb-2 text-sm font-medium">
            Security Key Name
          </label>
          <input
            type="text"
            id="keyName"
            bind:value={keyName}
            placeholder="e.g., My YubiKey, Touch ID, Windows Hello"
            disabled={isRegistering}
            required
          />
        </div>
        <div class="flex space-x-4">
          <button
            type="submit"
            class="btn btn-primary"
            disabled={isRegistering}
          >
            {#if isRegistering}
              <svg
                class="animate-spin -ml-1 mr-3 h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Complete Registration on Your Device...
            {:else}
              Register Security Key
            {/if}
          </button>
          <button
            type="button"
            onclick={toggleAddForm}
            class="btn btn-secondary"
            disabled={isRegistering}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  {:else}
    <div class="space-y-5">
      <p>
        Security Keys (WebAuthn) provide a secure passwordless authentication
        option using hardware security keys, fingerprints, or facial
        recognition.
      </p>

      <!-- List of existing security keys -->
      {#if securityKeys.length === 0}
        <p>No security keys registered.</p>
      {:else}
        <div class="space-y-4">
          <ul class="space-y-3">
            {#each securityKeys as key (key.id)}
              <li
                class="flex items-center justify-between pb-2"
                style="border-bottom: 1px solid var(--border-color);"
              >
                <div>
                  <span class="font-medium">
                    {key.nickname || "Unnamed key"}
                  </span>
                  <span class="text-sm ml-2" style="color: var(--text-muted);">
                    ID: {key.credentialId.slice(0, 8)}...
                  </span>
                </div>
                <button
                  onclick={() => deleteSecurityKey(key.id)}
                  disabled={isDeleting && deletingKeyId === key.id}
                  class="action-icon action-icon-delete"
                  title="Delete security key from your account"
                >
                  {#if isDeleting && deletingKeyId === key.id}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6" />
                    </svg>
                  {:else}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path
                        d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                      />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      <button
        onclick={toggleAddForm}
        disabled={!isWebAuthnAvailable}
        class="btn btn-primary"
      >
        Register New Security Key
      </button>
    </div>
  {/if}
</div>

<style>
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }
</style>
