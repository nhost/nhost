<script lang="ts">
import { auth } from '$lib/nhost/auth';
</script>

<div class="container">
  <header class="page-header">
    <h1 class="page-title">Welcome to Nhost SvelteKit Demo</h1>
  </header>

  {#if $auth.isAuthenticated}
    <div>
      <p>Hello, {$auth.user?.displayName || $auth.user?.email}!</p>
    </div>
  {:else}
    <div>
      <p>You are not signed in.</p>
    </div>
  {/if}
</div>
