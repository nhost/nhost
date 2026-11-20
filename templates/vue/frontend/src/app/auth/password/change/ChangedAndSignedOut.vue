<script setup lang="ts">
import { onMounted } from 'vue';
import PasswordChanged from '@/app/auth/password/PasswordChanged.vue';
import { nhost } from '@/lib/nhost/client';

/**
 * The changed card, for a change that could not sign this browser back in.
 * The stored session is cleared only once the card has replaced the account
 * page, so nothing under it reacts to the sign-out. The change already revoked
 * it, so there is nothing to tell the auth service.
 */
onMounted(() => {
  nhost.sessionStorage.remove();
});
</script>

<template>
  <PasswordChanged />
</template>
