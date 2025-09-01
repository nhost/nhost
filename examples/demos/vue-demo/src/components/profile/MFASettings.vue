<template>
  <div class="glass-card p-8 mb-6">
    <h3 class="text-xl mb-4">Multi-Factor Authentication</h3>

    <div v-if="error" class="alert alert-error mb-4">{{ error }}</div>

    <div v-if="success" class="alert alert-success mb-4">{{ success }}</div>

    <div v-if="isSettingUpMfa" class="space-y-5">
      <p>
        Scan this QR code with your authenticator app (e.g., Google
        Authenticator, Authy):
      </p>

      <div v-if="qrCodeUrl" class="flex justify-center my-4">
        <div class="p-2 bg-white rounded-md">
          <img :src="qrCodeUrl" alt="TOTP QR Code" width="200" height="200" />
        </div>
      </div>

      <p>Or manually enter this secret key:</p>
      <div class="p-2 bg-gray-100 rounded text-center text-black">
        {{ totpSecret }}
      </div>

      <div>
        <label for="verification-code">Verification Code</label>
        <input
          id="verification-code"
          type="text"
          v-model="verificationCode"
          placeholder="Enter 6-digit code"
          maxlength="6"
          required
        />
      </div>

      <div class="flex space-x-3">
        <button
          @click="handleVerifyTotp"
          :disabled="isLoading || !verificationCode"
          class="btn btn-primary"
        >
          {{ isLoading ? "Verifying..." : "Verify and Enable" }}
        </button>

        <button
          @click="handleCancelMfaSetup"
          :disabled="isLoading"
          class="btn btn-secondary"
        >
          Cancel
        </button>
      </div>
    </div>

    <div v-else-if="isDisablingMfa" class="space-y-5">
      <p>
        To disable Multi-Factor Authentication, please enter the current
        verification code from your authenticator app.
      </p>

      <div>
        <label for="disable-verification-code">
          Current Verification Code
        </label>
        <input
          id="disable-verification-code"
          type="text"
          v-model="disableVerificationCode"
          placeholder="Enter 6-digit code"
          maxlength="6"
          required
        />
      </div>

      <div class="flex space-x-3">
        <button
          @click="handleDisableMfa"
          :disabled="isLoading || !disableVerificationCode"
          class="btn btn-primary"
        >
          {{ isLoading ? "Disabling..." : "Confirm Disable" }}
        </button>

        <button
          @click="handleCancelMfaDisable"
          :disabled="isLoading"
          class="btn btn-secondary"
        >
          Cancel
        </button>
      </div>
    </div>

    <div v-else class="space-y-5">
      <p>
        Multi-Factor Authentication adds an extra layer of security to your
        account by requiring a verification code from your authenticator app
        when signing in.
      </p>

      <div class="flex items-center">
        <span class="mr-3">Status:</span>
        <span
          class="font-semibold"
          :class="isMfaEnabled ? 'text-green-500' : 'text-yellow-500'"
        >
          {{ isMfaEnabled ? "Enabled" : "Disabled" }}
        </span>
      </div>

      <button
        v-if="isMfaEnabled"
        @click="handleShowDisableMfa"
        :disabled="isLoading"
        class="btn btn-secondary"
      >
        {{ isLoading ? "Processing..." : "Disable MFA" }}
      </button>
      <button
        v-else
        @click="handleEnableMfa"
        :disabled="isLoading"
        class="btn btn-primary"
      >
        {{ isLoading ? "Loading..." : "Enable MFA" }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useAuth } from "../../lib/nhost/auth";
import { type ErrorResponse } from "@nhost/nhost-js/auth";
import { type FetchError } from "@nhost/nhost-js/fetch";

interface Props {
  initialMfaEnabled: boolean;
}

const props = defineProps<Props>();

const { nhost } = useAuth();

const isMfaEnabled = ref<boolean>(props.initialMfaEnabled);
const isLoading = ref<boolean>(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

// MFA setup states
const isSettingUpMfa = ref<boolean>(false);
const totpSecret = ref<string>("");
const qrCodeUrl = ref<string>("");
const verificationCode = ref<string>("");

// Disabling MFA states
const isDisablingMfa = ref<boolean>(false);
const disableVerificationCode = ref<string>("");

// Update internal state when prop changes
watch(
  () => props.initialMfaEnabled,
  (newValue) => {
    if (newValue !== isMfaEnabled.value) {
      isMfaEnabled.value = newValue;
    }
  },
);

// Begin MFA setup process
const handleEnableMfa = async (): Promise<void> => {
  isLoading.value = true;
  error.value = null;
  success.value = null;

  try {
    // Generate TOTP secret
    const response = await nhost.auth.changeUserMfa();
    totpSecret.value = response.body.totpSecret;
    qrCodeUrl.value = response.body.imageUrl;
    isSettingUpMfa.value = true;
  } catch (err) {
    const errorObj = err as FetchError<ErrorResponse>;
    error.value = `An error occurred while enabling MFA: ${errorObj.message}`;
  } finally {
    isLoading.value = false;
  }
};

// Verify TOTP and enable MFA
const handleVerifyTotp = async (): Promise<void> => {
  if (!verificationCode.value) {
    error.value = "Please enter the verification code";
    return;
  }

  isLoading.value = true;
  error.value = null;
  success.value = null;

  try {
    // Verify and activate MFA
    await nhost.auth.verifyChangeUserMfa({
      activeMfaType: "totp",
      code: verificationCode.value,
    });

    isMfaEnabled.value = true;
    isSettingUpMfa.value = false;
    success.value = "MFA has been successfully enabled.";
  } catch (err) {
    const errorObj = err as FetchError<ErrorResponse>;
    error.value = `An error occurred while verifying the code: ${errorObj.message}`;
  } finally {
    isLoading.value = false;
  }
};

// Show disable MFA confirmation
const handleShowDisableMfa = (): void => {
  isDisablingMfa.value = true;
  error.value = null;
  success.value = null;
};

// Disable MFA
const handleDisableMfa = async (): Promise<void> => {
  if (!disableVerificationCode.value) {
    error.value = "Please enter your verification code to confirm";
    return;
  }

  isLoading.value = true;
  error.value = null;
  success.value = null;

  try {
    // Disable MFA by setting activeMfaType to empty string
    await nhost.auth.verifyChangeUserMfa({
      activeMfaType: "",
      code: disableVerificationCode.value,
    });

    isMfaEnabled.value = false;
    isDisablingMfa.value = false;
    disableVerificationCode.value = "";
    success.value = "MFA has been successfully disabled.";
  } catch (err) {
    const errorObj = err as FetchError<ErrorResponse>;
    error.value = `An error occurred while disabling MFA: ${errorObj.message}`;
  } finally {
    isLoading.value = false;
  }
};

// Cancel MFA setup
const handleCancelMfaSetup = (): void => {
  isSettingUpMfa.value = false;
  totpSecret.value = "";
  qrCodeUrl.value = "";
  verificationCode.value = "";
};

// Cancel MFA disable
const handleCancelMfaDisable = (): void => {
  isDisablingMfa.value = false;
  disableVerificationCode.value = "";
  error.value = null;
};
</script>
