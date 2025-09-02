<script lang="ts">
import { nhost } from "$lib/nhost/auth";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import type { ErrorResponse } from "@nhost/nhost-js/auth";
import type { FetchError } from "@nhost/nhost-js/fetch";

interface Props {
  buttonLabel?: string;
}

let { buttonLabel = "Send Magic Link" }: Props = $props();

let email = $state("");
let isLoading = $state(false);
let success = $state(false);
let error = $state<string | null>(null);

async function handleSubmit(e: Event) {
  e.preventDefault();
  isLoading = true;
  error = null;

  try {
    await nhost.auth.signInPasswordlessEmail({
      email,
      options: {
        redirectTo: `${window.location.origin}/verify`,
      },
    });

    // Navigate to current page with magic=success parameter for persistent feedback
    const currentPath = $page.url.pathname;
    void goto(`${currentPath}?magic=success`);
  } catch (err) {
    const fetchError = err as FetchError<ErrorResponse>;
    error = `An error occurred while sending the magic link: ${fetchError.message}`;
  } finally {
    isLoading = false;
  }
}

function tryAgain() {
  success = false;
  email = "";
  error = null;
}
</script>

{#if success}
  <div class="text-center">
    <p class="mb-4">Magic link sent! Check your email to sign in.</p>
    <button onclick={tryAgain} class="btn btn-secondary"> Try again </button>
  </div>
{:else}
  <form onsubmit={handleSubmit} class="space-y-5">
    <div>
      <label for="magic-email">Email</label>
      <input id="magic-email" type="email" bind:value={email} required />
    </div>

    {#if error}
      <div class="alert alert-error">{error}</div>
    {/if}

    <button type="submit" class="btn btn-primary w-full" disabled={isLoading}>
      {isLoading ? "Sending..." : buttonLabel}
    </button>
  </form>
{/if}
