<script setup lang="ts">
import { computed } from 'vue';

/** Says why an auth redirect failed. */
const props = defineProps<{ error?: string | null }>();

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

const message = computed(() =>
  props.error ? messages.get(props.error) : undefined,
);
</script>

<template>
  <p
    v-if="error"
    role="alert"
    class="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive text-sm"
  >
    <template v-if="message">
      {{ message }} <span class="font-mono text-xs">({{ error }})</span>
    </template>
    <template v-else>Sign-in failed.</template>
  </p>
</template>
