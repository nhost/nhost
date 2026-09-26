<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuth } from '@/lib/nhost/auth';

const { nhost, isAuthenticated } = useAuth();
const connected = ref<boolean | null>(null);

onMounted(async () => {
  try {
    await nhost.graphql.request({ query: '{ __typename }' });
    connected.value = true;
  } catch {
    connected.value = false;
  }
});
</script>

<template>
  <div class="stack">
    <h1>Nhost + Vue</h1>
    <p class="muted">
      A full-stack starter. The backend (auth, database and GraphQL API) lives
      in <code>backend/</code>; this app lives in <code>frontend/</code>.
    </p>

    <div class="card">
      <strong>
        <template v-if="connected === null">Checking backend…</template>
        <template v-else-if="connected">Connected to Nhost GraphQL</template>
        <template v-else>Backend not reachable</template>
      </strong>
      <p class="muted">
        <template v-if="connected">The app reached your GraphQL API.</template>
        <template v-else>
          Start the backend with <code>cd backend &amp;&amp; nhost up</code>,
          then reload.
        </template>
      </p>
    </div>

    <div class="row">
      <RouterLink class="button" to="/signin">Sign in</RouterLink>
      <RouterLink class="button ghost" to="/protected">
        {{ isAuthenticated ? 'Your todos' : 'Protected page' }}
      </RouterLink>
    </div>
  </div>
</template>
