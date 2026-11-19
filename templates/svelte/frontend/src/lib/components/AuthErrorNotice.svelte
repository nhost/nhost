<!-- @component Says why an auth redirect failed. -->
<script lang="ts" module>
  type Param = string | string[] | null | undefined;

  const first = (value: Param): string | null | undefined =>
    Array.isArray(value) ? value[0] : value;

  // The codes the auth service can redirect back with, from its
  // `sendRedirectError` callers.
  const messages = new Map([
    [
      'disabled-endpoint',
      'This sign-in provider is not turned on. If this is your app, enable it in nhost/nhost.toml.',
    ],
    ['disabled-user', 'Your account is disabled.'],
    [
      'internal-server-error',
      'Something went wrong on our side. Please try again.',
    ],
    ['invalid-email-password', 'We could not sign you in with that account.'],
    [
      'invalid-request',
      'Something was wrong with the sign-in request. Please start again.',
    ],
    [
      'invalid-state',
      'Your sign-in took too long or was interrupted. Please start again.',
    ],
    ['invalid-ticket', 'This link is invalid or has expired. Request a new one.'],
    [
      'oauth-profile-fetch-failed',
      'We could not read your profile from the provider. Please try again.',
    ],
    [
      'oauth-provider-error',
      'The provider did not complete your sign-in. Please try again.',
    ],
    // The missing x is the spelling the auth service sends.
    [
      'oauth-token-echange-failed',
      'We could not finish signing you in with the provider. Please try again.',
    ],
    [
      'provider-account-already-linked',
      'This provider account is already linked to another user.',
    ],
    [
      'redirectTo-not-allowed',
      'This app is not on the list of addresses the sign-in may return to.',
    ],
    ['signup-disabled', 'New sign-ups are turned off.'],
    ['unverified-user', 'Verify your email address first, then try again.'],
    ['user-already-exists', 'An account with this email address already exists.'],
  ]);
</script>

<script lang="ts">
  let { error }: { error: Param } = $props();

  const code = $derived(first(error));
  const message = $derived(code ? messages.get(code) : undefined);
</script>

{#if code}
  <p
    role="alert"
    class="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive text-sm"
  >
    {#if message}
      {message} <span class="font-mono text-xs">({code})</span>
    {:else}
      Sign-in failed.
    {/if}
  </p>
{/if}
