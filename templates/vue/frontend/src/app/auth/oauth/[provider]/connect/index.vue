<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ACCOUNT_PICKER,
  configuredProviders,
} from '@/app/auth/oauth/providers';
import { signInHref } from '@/app/signin/destination';
import NotFound from '@/components/NotFound.vue';
import { nhost } from '@/lib/nhost/client';
import { appOrigin } from '@/lib/nhost/env';

const ACCOUNT_PATH = '/account';

/**
 * Where a Link account button goes: the same provider round trip as signing in,
 * with the session's access token as `connect`, which tells the auth service to
 * add the provider to that account rather than sign anyone in.
 */
const route = useRoute('/auth/oauth/[provider]/connect/');
const router = useRouter();
const found = computed(() =>
  configuredProviders().find(({ id }) => id === route.params.provider),
);

onMounted(async () => {
  const provider = found.value;
  if (!provider) {
    return;
  }

  // Refreshed first, so the token the auth service reads has not expired.
  const session = await nhost.refreshSession(60);
  if (!session) {
    await router.replace(signInHref(ACCOUNT_PATH));
    return;
  }

  window.location.replace(
    nhost.auth.signInProviderURL(provider.id, {
      connect: session.accessToken,
      redirectTo: appOrigin() + ACCOUNT_PATH,
      upstreamParams: ACCOUNT_PICKER,
    }),
  );
});
</script>

<template>
  <NotFound v-if="!found" />
</template>
