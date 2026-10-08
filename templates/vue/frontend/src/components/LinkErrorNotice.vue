<script setup lang="ts">
import { onUnmounted } from 'vue';
import { START_LOCATION, useRouter } from 'vue-router';
import { useAuth } from '@/lib/nhost/auth';

/**
 * Says why the link or provider redirect the visitor arrived from did not
 * sign them in. It sits above every page because that can be any of them: an
 * auth email or a provider comes back to wherever `next` said.
 *
 * It goes once the visitor moves on, except to sign-in: that is where trying
 * again starts, and where a protected page sends someone the link did not
 * sign in, so the reason still applies there.
 */
const { linkError, clearLinkError } = useAuth();

const stopListening = useRouter().afterEach((to, from, failure) => {
  if (
    !failure &&
    from !== START_LOCATION &&
    to.path !== from.path &&
    to.path !== '/signin'
  ) {
    clearLinkError();
  }
});

onUnmounted(stopListening);
</script>

<template>
  <p
    v-if="linkError"
    role="alert"
    class="mx-auto mb-6 max-w-md text-destructive text-sm"
  >
    {{ linkError }}
  </p>
</template>
