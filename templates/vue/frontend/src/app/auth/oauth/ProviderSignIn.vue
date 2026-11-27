<script setup lang="ts">
import { computed } from 'vue';
import { DEFAULT_INTENT } from '@/app/signin/intent';
import { signInQuery } from '@/app/signin/query';
import OAuthButtons from './OAuthButtons.vue';
import { configuredProviders, providerHref } from './providers';

/**
 * A button for each provider the deployment set up, shown on the sign-in list
 * itself.
 */
const props = defineProps<{ destination: string; lastUsed: string | null }>();

const links = computed(() =>
  configuredProviders().map(({ id, label }) => ({
    id,
    label,
    href: `${providerHref(id)}${signInQuery(props.destination, DEFAULT_INTENT)}`,
    lastUsed: providerHref(id) === props.lastUsed,
  })),
);
</script>

<template>
  <OAuthButtons :links="links" />
</template>
