<script setup lang="ts">
import { useSignOut } from '@/components/useSignOut';

/** Sign out as a link in running text. */
const { error, isSigningOut, handleSignOut } = useSignOut();
</script>

<template>
  <button
    type="button"
    :disabled="isSigningOut"
    class="cursor-pointer text-foreground underline underline-offset-4 disabled:cursor-default disabled:opacity-50"
    @click="handleSignOut"
  >
    <slot />
  </button>
  <span v-if="error" role="alert" class="text-destructive"> ({{ error }})</span>
</template>
