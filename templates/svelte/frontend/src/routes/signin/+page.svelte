<script lang="ts">
import { goto } from '$app/navigation';
import { nhost } from '$lib/nhost/auth';

let email = $state('');
let otp = $state('');
let sent = $state(false);
let loading = $state(false);
let error = $state<string | null>(null);

async function sendCode(): Promise<void> {
  loading = true;
  error = null;
  try {
    await nhost.auth.signInOTPEmail({ email });
    sent = true;
  } catch (err) {
    error = `Could not send the code: ${(err as Error).message}`;
  } finally {
    loading = false;
  }
}

async function verify(): Promise<void> {
  loading = true;
  error = null;
  try {
    const response = await nhost.auth.verifySignInOTPEmail({ email, otp });
    if (response.body?.session) {
      goto('/protected');
    } else {
      error = 'Invalid or expired code. Please try again.';
    }
  } catch (err) {
    error = `Could not verify the code: ${(err as Error).message}`;
  } finally {
    loading = false;
  }
}

function onSubmit(event: SubmitEvent): void {
  event.preventDefault();
  if (sent) {
    void verify();
  } else {
    void sendCode();
  }
}
</script>

<div class="stack">
  <h1>Sign in</h1>
  <p class="muted">
    Enter your email and we'll send a one-time code. While running locally, the
    email with the code is captured by the local mail viewer.
  </p>

  <form class="card stack" onsubmit={onSubmit}>
    {#if sent}
      <label class="field">
        <span>Code sent to {email}</span>
        <input
          bind:value={otp}
          inputmode="numeric"
          placeholder="123456"
          autocomplete="one-time-code"
        />
      </label>
    {:else}
      <label class="field">
        <span>Email</span>
        <input
          bind:value={email}
          type="email"
          placeholder="you@example.com"
          autocomplete="email"
          required
        />
      </label>
    {/if}

    <button
      class="button"
      type="submit"
      disabled={loading || (sent ? !otp : !email)}
    >
      {loading ? 'Working…' : sent ? 'Verify' : 'Send code'}
    </button>

    {#if error}<p class="error">{error}</p>{/if}
  </form>
</div>
