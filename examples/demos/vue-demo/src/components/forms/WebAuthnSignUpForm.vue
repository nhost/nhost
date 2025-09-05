<template>
  <form @submit.prevent="startWebAuthnRegistration" class="space-y-5">
    <div>
      <label for="webauthnDisplayName">Display Name</label>
      <input id="webauthnDisplayName" type="text" v-model="displayName" />
    </div>

    <div>
      <label for="webauthnEmail">Email</label>
      <input id="webauthnEmail" type="email" v-model="email" required />
    </div>

    <div>
      <label for="keyNickname">Key Nickname (Optional)</label>
      <input
        id="keyNickname"
        type="text"
        v-model="keyNickname"
        placeholder="My Security Key"
      />
      <p class="text-xs mt-1 text-gray-400">
        A friendly name for your security key
      </p>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <button
      type="submit"
      class="btn btn-primary w-full"
      :disabled="isLoading || !email"
    >
      {{
        isLoading
          ? challengeData
            ? "Complete Registration on Your Device..."
            : "Initializing..."
          : "Register with Security Key"
      }}
    </button>

    <div class="text-xs mt-2 text-gray-400">
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
</template>

<script setup lang="ts">
import {
  type ErrorResponse,
  type PublicKeyCredentialCreationOptions,
} from "@nhost/nhost-js/auth";
import { type FetchError } from "@nhost/nhost-js/fetch";
import { startRegistration } from "@simplewebauthn/browser";
import { ref } from "vue";
import { useAuth } from "../../lib/nhost/auth";
import { isWebAuthnSupported } from "../../lib/utils";

/**
 * WebAuthn Registration (Sign Up) Flow
 *
 * This component handles new user registration using WebAuthn/FIDO2 standards.
 * Instead of creating a password, users register using biometrics or security keys,
 * providing a more secure and phishing-resistant authentication method.
 */

/**
 * Props for the WebAuthn signup form
 */
interface Props {
  email: string;
  displayName: string;
  redirectTo?: string;
}

const props = withDefaults(defineProps<Props>(), {
  redirectTo: undefined,
});

const emit = defineEmits<{
  "update:email": [value: string];
  "update:displayName": [value: string];
}>();

const { nhost } = useAuth();
const isLoading = ref<boolean>(false);
const error = ref<string | null>(null);
const keyNickname = ref<string>("");
const challengeData = ref<PublicKeyCredentialCreationOptions | null>(null);

// Local reactive refs for v-model
const email = ref(props.email);
const displayName = ref(props.displayName);

// Watch for changes and emit updates
import { watch } from "vue";

watch(email, (newValue) => {
  emit("update:email", newValue);
});

watch(displayName, (newValue) => {
  emit("update:displayName", newValue);
});

// Watch for prop changes
watch(
  () => props.email,
  (newValue) => {
    email.value = newValue;
  },
);

watch(
  () => props.displayName,
  (newValue) => {
    displayName.value = newValue;
  },
);

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
const startWebAuthnRegistration = async (): Promise<void> => {
  isLoading.value = true;
  error.value = null;

  // Validate required fields
  if (!email.value) {
    error.value = "Email is required";
    isLoading.value = false;
    return;
  }

  // Check browser compatibility before proceeding
  if (!isWebAuthnSupported()) {
    error.value = "WebAuthn is not supported by your browser.";
    isLoading.value = false;
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
      email: email.value,
      options: {
        displayName: displayName.value,
      },
    });

    // Store the challenge data for UI feedback
    challengeData.value = response.body;

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
        error.value = "No credential was created.";
        isLoading.value = false;
        return;
      }

      // Step 3: Send the credential attestation to the server for verification
      // The server verifies the attestation signature and certificate chain,
      // then stores the public key for future authentication attempts
      const verifyResponse = await nhost.auth.verifySignUpWebauthn({
        credential,
        options: {
          displayName: displayName.value || undefined,
        },
        nickname:
          keyNickname.value ||
          `Security Key for ${displayName.value || email.value}`,
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
          props.redirectTo || `${window.location.origin}/profile`;
      }
    } catch (credError) {
      error.value = `WebAuthn registration failed: ${(credError as Error).message || "Unknown error"}`;
    }
  } catch (err) {
    const errorObj = err as FetchError<ErrorResponse>;
    error.value = `An error occurred during WebAuthn sign up: ${errorObj.message}`;
  } finally {
    isLoading.value = false;
  }
};
</script>
