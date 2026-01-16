<script lang="ts">
import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { auth, nhost } from '$lib/nhost/auth';

interface VerificationResponse {
  success?: boolean;
  error?: string;
}

let otp = $state('');
let isLoading = $state(false);
let error = $state<string | null>(null);
let ticket = $state<string | null>(null);

// Extract ticket and initial error from URL search params
$effect(() => {
  const urlParams = new URLSearchParams($page.url.search);
  ticket = urlParams.get('ticket');
  const initialError = urlParams.get('error');
  if (initialError) {
    error = initialError;
  }
});

// Handle redirects
$effect(() => {
  // If user is already authenticated, redirect to profile
  if ($auth.isAuthenticated) {
    void goto('/profile', { replaceState: true });
    return;
  }

  // If no ticket is provided, redirect to sign in
  if (!ticket && !isLoading) {
    void goto('/signin', { replaceState: true });
    return;
  }
});

async function handleSubmit(e: SubmitEvent) {
  e.preventDefault();
  isLoading = true;
  error = null;

  try {
    const result = await verifyMfa(ticket as string, otp);

    if (result.error) {
      error = result.error;
    } else if (result.success) {
      void goto('/profile', { replaceState: true });
    }
  } catch (err) {
    const fetchError = err as FetchError<ErrorResponse>;
    error = `An error occurred during verification: ${fetchError.message}`;
  } finally {
    isLoading = false;
  }
}

// Function to verify MFA code
async function verifyMfa(
  ticket: string,
  otp: string,
): Promise<VerificationResponse> {
  try {
    // Verify MFA code
    const response = await nhost.auth.verifySignInMfaTotp({
      ticket,
      otp,
    });

    // Check for successful verification
    if (response.body?.session) {
      return { success: true };
    }

    return { error: 'Failed to verify MFA code. Please try again.' };
  } catch (err) {
    const fetchError = err as FetchError<ErrorResponse>;
    return { error: `Failed to verify code: ${fetchError.message}` };
  }
}
</script>

<div class="flex flex-col items-center justify-center">
  <h1 class="text-3xl mb-6 gradient-text">Nhost SDK Demo</h1>

  <div class="glass-card w-full p-8 mb-6">
    <h2 class="text-2xl mb-6">Verification Required</h2>

    <div>
      <p class="mb-4">
        A verification code is required to complete sign in. Please enter the
        code from your authenticator app.
      </p>

      <form onsubmit={handleSubmit} class="space-y-5">
        <div>
          <label for="otp">Verification Code</label>
          <input
            id="otp"
            name="otp"
            type="text"
            placeholder="Enter 6-digit code"
            maxlength="6"
            bind:value={otp}
            required
          />
        </div>

        {#if error}
          <div class="alert alert-error">{error}</div>
        {/if}

        <div class="flex space-x-3">
          <button type="submit" class="btn btn-primary" disabled={isLoading}>
            {isLoading ? "Verifying..." : "Verify"}
          </button>

          <a href="/signin" class="btn btn-secondary"> Back </a>
        </div>
      </form>
    </div>
  </div>
</div>
