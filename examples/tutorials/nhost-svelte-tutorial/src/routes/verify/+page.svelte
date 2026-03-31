<script lang="ts">
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { nhost } from '$lib/nhost/auth';

const PKCE_VERIFIER_KEY = 'nhost_pkce_verifier';

function consumePKCEVerifier(): string | null {
  const verifier = localStorage.getItem(PKCE_VERIFIER_KEY);
  if (verifier) {
    localStorage.removeItem(PKCE_VERIFIER_KEY);
  }
  return verifier;
}

let status: 'verifying' | 'success' | 'error' = 'verifying';
let error = '';
let urlParams: Record<string, string> = {};

onMount(() => {
  const params = new URLSearchParams($page.url.search);
  const code = params.get('code');

  if (!code) {
    const allParams: Record<string, string> = {};
    params.forEach((value, key) => {
      allParams[key] = value;
    });
    urlParams = allParams;

    status = 'error';
    error = 'No authorization code found in URL';
    return;
  }

  const authCode = code;
  let isMounted = true;

  async function exchangeCode() {
    try {
      // Small delay to ensure component is fully mounted
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (!isMounted) return;

      const codeVerifier = consumePKCEVerifier();
      if (!codeVerifier) {
        status = 'error';
        error =
          'No PKCE verifier found. The sign-in must be initiated from the same browser tab.';
        return;
      }

      await nhost.auth.tokenExchange({ code: authCode, codeVerifier });

      if (!isMounted) return;

      status = 'success';

      setTimeout(() => {
        if (isMounted) void goto('/profile');
      }, 1500);
    } catch (err) {
      const message = (err as Error).message || 'Unknown error';
      if (!isMounted) return;

      status = 'error';
      error = `An error occurred during verification: ${message}`;
    }
  }

  void exchangeCode();

  return () => {
    isMounted = false;
  };
});
</script>

<div>
  <h1>Email Verification</h1>

  <div class="page-center">
    {#if status === "verifying"}
      <div>
        <p class="margin-bottom">Verifying your email...</p>
        <div class="spinner-verify" />
      </div>
    {/if}

    {#if status === "success"}
      <div>
        <p class="verification-status">
          ✓ Successfully verified!
        </p>
        <p>You'll be redirected to your profile page shortly...</p>
      </div>
    {/if}

    {#if status === "error"}
      <div>
        <p class="verification-status error">
          Verification failed
        </p>
        <p class="margin-bottom">{error}</p>

        {#if Object.keys(urlParams).length > 0}
          <div class="debug-panel">
            <p class="debug-title">
              URL Parameters:
            </p>
            {#each Object.entries(urlParams) as [key, value] (key)}
              <div class="debug-item">
                <span class="debug-key">
                  {key}:
                </span>
                <span class="debug-value">{value}</span>
              </div>
            {/each}
          </div>
        {/if}

        <button
          type="button"
          onclick={() => goto("/signin")}
          class="auth-button secondary"
        >
          Back to Sign In
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .spinner-verify {
    width: 2rem;
    height: 2rem;
    border: 2px solid transparent;
    border-top: 2px solid var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto;
  }
</style>
