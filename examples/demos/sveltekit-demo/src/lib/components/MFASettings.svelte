<script lang="ts">
import type { ErrorResponse } from "@nhost/nhost-js/auth";
import type { FetchError } from "@nhost/nhost-js/fetch";
import { nhost } from "$lib/nhost/auth";

interface Props {
  initialMfaEnabled: boolean;
}

let { initialMfaEnabled }: Props = $props();

let isMfaEnabled = $state(initialMfaEnabled);
let isLoading = $state(false);
let error: string | null = $state(null);
let success: string | null = $state(null);

// MFA setup states
let isSettingUpMfa = $state(false);
let totpSecret = $state("");
let qrCodeUrl = $state("");
let verificationCode = $state("");

// Disabling MFA states
let isDisablingMfa = $state(false);
let disableVerificationCode = $state("");

// Update internal state when prop changes
$effect(() => {
  if (initialMfaEnabled !== isMfaEnabled) {
    isMfaEnabled = initialMfaEnabled;
  }
});

// Begin MFA setup process
async function handleEnableMfa() {
  isLoading = true;
  error = null;
  success = null;

  try {
    // Generate TOTP secret
    const response = await nhost.auth.changeUserMfa();
    totpSecret = response.body.totpSecret;
    qrCodeUrl = response.body.imageUrl;
    isSettingUpMfa = true;
  } catch (err) {
    const fetchError = err as FetchError<ErrorResponse>;
    error = `An error occurred while enabling MFA: ${fetchError.message}`;
  } finally {
    isLoading = false;
  }
}

// Verify TOTP and enable MFA
async function handleVerifyTotp() {
  if (!verificationCode) {
    error = "Please enter the verification code";
    return;
  }

  isLoading = true;
  error = null;
  success = null;

  try {
    // Verify and activate MFA
    await nhost.auth.verifyChangeUserMfa({
      activeMfaType: "totp",
      code: verificationCode,
    });

    isMfaEnabled = true;
    isSettingUpMfa = false;
    success = "MFA has been successfully enabled.";
  } catch (err) {
    const fetchError = err as FetchError<ErrorResponse>;
    error = `An error occurred while verifying the code: ${fetchError.message}`;
  } finally {
    isLoading = false;
  }
}

// Show disable MFA confirmation
function handleShowDisableMfa() {
  isDisablingMfa = true;
  error = null;
  success = null;
}

// Disable MFA
async function handleDisableMfa() {
  if (!disableVerificationCode) {
    error = "Please enter your verification code to confirm";
    return;
  }

  isLoading = true;
  error = null;
  success = null;

  try {
    // Disable MFA by setting activeMfaType to empty string
    await nhost.auth.verifyChangeUserMfa({
      activeMfaType: "",
      code: disableVerificationCode,
    });

    isMfaEnabled = false;
    isDisablingMfa = false;
    disableVerificationCode = "";
    success = "MFA has been successfully disabled.";
  } catch (err) {
    const fetchError = err as FetchError<ErrorResponse>;
    error = `An error occurred while disabling MFA: ${fetchError.message}`;
  } finally {
    isLoading = false;
  }
}

// Cancel MFA setup
function handleCancelMfaSetup() {
  isSettingUpMfa = false;
  totpSecret = "";
  qrCodeUrl = "";
  verificationCode = "";
}

// Cancel MFA disable
function handleCancelMfaDisable() {
  isDisablingMfa = false;
  disableVerificationCode = "";
  error = null;
}
</script>

<div class="glass-card p-8 mb-6">
  <h3 class="text-xl mb-4">Multi-Factor Authentication</h3>

  {#if error}
    <div class="alert alert-error mb-4">{error}</div>
  {/if}

  {#if success}
    <div class="alert alert-success mb-4">{success}</div>
  {/if}

  {#if isSettingUpMfa}
    <div class="space-y-5">
      <p>
        Scan this QR code with your authenticator app (e.g., Google
        Authenticator, Authy):
      </p>

      {#if qrCodeUrl}
        <div class="flex justify-center my-4">
          <div class="p-2 bg-white rounded-md">
            <img src={qrCodeUrl} alt="TOTP QR Code" width="200" height="200" />
          </div>
        </div>
      {/if}

      <p>Or manually enter this secret key:</p>
      <div class="p-2 bg-gray-100 rounded text-center text-black">
        {totpSecret}
      </div>

      <div>
        <label for="verification-code">Verification Code</label>
        <input
          id="verification-code"
          type="text"
          bind:value={verificationCode}
          placeholder="Enter 6-digit code"
          maxlength="6"
          required
        />
      </div>

      <div class="flex space-x-4">
        <button
          onclick={handleVerifyTotp}
          disabled={isLoading || !verificationCode}
          class="btn btn-primary"
        >
          {isLoading ? "Verifying..." : "Verify and Enable"}
        </button>

        <button
          onclick={handleCancelMfaSetup}
          disabled={isLoading}
          class="btn btn-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  {:else if isDisablingMfa}
    <div class="space-y-5">
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
          bind:value={disableVerificationCode}
          placeholder="Enter 6-digit code"
          maxlength="6"
          required
        />
      </div>

      <div class="flex space-x-4">
        <button
          onclick={handleDisableMfa}
          disabled={isLoading || !disableVerificationCode}
          class="btn btn-primary"
        >
          {isLoading ? "Disabling..." : "Confirm Disable"}
        </button>

        <button
          onclick={handleCancelMfaDisable}
          disabled={isLoading}
          class="btn btn-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  {:else}
    <div class="space-y-5">
      <p>
        Multi-Factor Authentication adds an extra layer of security to your
        account by requiring a verification code from your authenticator app
        when signing in.
      </p>

      <div class="flex items-center">
        <span class="mr-3">Status:</span>
        <span
          class="font-semibold"
          style="color: {isMfaEnabled ? 'var(--success)' : 'var(--secondary)'}"
        >
          {isMfaEnabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {#if isMfaEnabled}
        <button
          onclick={handleShowDisableMfa}
          disabled={isLoading}
          class="btn btn-secondary"
        >
          {isLoading ? "Processing..." : "Disable MFA"}
        </button>
      {:else}
        <button
          onclick={handleEnableMfa}
          disabled={isLoading}
          class="btn btn-primary"
        >
          {isLoading ? "Loading..." : "Enable MFA"}
        </button>
      {/if}
    </div>
  {/if}
</div>
