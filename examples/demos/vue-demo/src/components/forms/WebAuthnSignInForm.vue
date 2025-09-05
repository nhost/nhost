<template>
  <form @submit.prevent="startWebAuthnSignIn" class="space-y-5">
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <button type="submit" class="btn btn-primary w-full" :disabled="isLoading">
      {{ isLoading ? "Authenticating..." : "Sign In with Security Key" }}
    </button>

    <div class="text-xs mt-2 text-gray-400">
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
</template>

<script setup lang="ts">
import { type ErrorResponse } from "@nhost/nhost-js/auth";
import { type FetchError } from "@nhost/nhost-js/fetch";
import { startAuthentication } from "@simplewebauthn/browser";
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../../lib/nhost/auth";
import { isWebAuthnSupported } from "../../lib/utils";

/**
 * WebAuthnSignInForm provides a passwordless authentication flow using WebAuthn (FIDO2) protocol.
 * This enables users to authenticate using biometrics, hardware security keys, or platform authenticators
 * instead of traditional passwords.
 */

const { nhost } = useAuth();
const router = useRouter();
const isLoading = ref<boolean>(false);
const error = ref<string | null>(null);

/**
 * Handles the WebAuthn authentication flow:
 * 1. Request a challenge from the server
 * 2. Have the browser/authenticator sign the challenge with the private key
 * 3. Verify the signature on the server and establish a session
 */
const startWebAuthnSignIn = async (): Promise<void> => {
  isLoading.value = true;
  error.value = null;

  try {
    // First check if WebAuthn is supported by this browser
    if (!isWebAuthnSupported()) {
      error.value = "WebAuthn is not supported by your browser.";
      isLoading.value = false;
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
        error.value = "No credential was selected.";
        isLoading.value = false;
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
        router.push("/profile");
      } else {
        error.value = "Authentication failed";
      }
    } catch (credError) {
      error.value = `WebAuthn authentication failed: ${(credError as Error).message || "Unknown error"}`;
    }
  } catch (err) {
    const errorObj = err as FetchError<ErrorResponse>;
    error.value = `An error occurred during WebAuthn sign in: ${errorObj.message}`;
  } finally {
    isLoading.value = false;
  }
};
</script>
