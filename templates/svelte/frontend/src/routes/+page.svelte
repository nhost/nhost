<script lang="ts">
import { onMount } from 'svelte';
import { isAuthenticated, nhost } from '$lib/nhost/auth';

let connected = $state<boolean | null>(null);

onMount(async () => {
  try {
    await nhost.graphql.request({ query: '{ __typename }' });
    connected = true;
  } catch {
    connected = false;
  }
});
</script>

<div class="stack">
  <h1>Nhost + Svelte</h1>
  <p class="muted">
    A full-stack starter. The backend (auth, database and GraphQL API) lives in
    <code>backend/</code>; this app lives in <code>frontend/</code>.
  </p>

  <div class="card">
    <strong>
      {#if connected === null}
        Checking backend…
      {:else if connected}
        Connected to Nhost GraphQL
      {:else}
        Backend not reachable
      {/if}
    </strong>
    <p class="muted">
      {#if connected}
        The app reached your GraphQL API.
      {:else}
        Start the backend with <code>cd backend &amp;&amp; nhost up</code>, then
        reload.
      {/if}
    </p>
  </div>

  <div class="row">
    <a class="button" href="/signin">Sign in</a>
    <a class="button ghost" href="/protected">
      {$isAuthenticated ? 'Your todos' : 'Protected page'}
    </a>
  </div>
</div>
