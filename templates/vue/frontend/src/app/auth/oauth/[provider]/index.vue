<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import {
  ACCOUNT_PICKER,
  configuredProviders,
  providerHref,
} from '@/app/auth/oauth/providers';
import { signInDestination } from '@/app/signin/destination';
import { recordSignInAttempt } from '@/app/signin/lastUsed';
import NotFound from '@/components/NotFound.vue';
import { nhost } from '@/lib/nhost/client';
import { appOrigin } from '@/lib/nhost/env';
import { firstQueryValue } from '@/lib/routeQuery';

/** Where a provider button goes before the provider. */
const route = useRoute('/auth/oauth/[provider]/');
const found = computed(() =>
  configuredProviders().find(({ id }) => id === route.params.provider),
);

// `replace` keeps this page out of the history, so Back from the provider skips
// it.
onMounted(() => {
  if (!found.value) {
    return;
  }

  recordSignInAttempt(providerHref(found.value.id));
  window.location.replace(
    nhost.auth.signInProviderURL(found.value.id, {
      redirectTo:
        appOrigin() + signInDestination(firstQueryValue(route.query.next)),
      upstreamParams: ACCOUNT_PICKER,
    }),
  );
});
</script>

<template>
  <NotFound v-if="!found" />
</template>
