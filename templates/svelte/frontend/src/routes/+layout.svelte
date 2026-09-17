<script lang="ts">
import { onMount } from 'svelte';
import '../app.css';
import { initializeAuth, isAuthenticated } from '$lib/nhost/auth';

let { children } = $props();

onMount(() => {
  initializeAuth();
});
</script>

<nav class="nav">
  <a href="/">Nhost + Svelte</a>
  <div class="row">
    <a href="/signin">Sign in</a>
    <a href="/protected">{$isAuthenticated ? 'Your todos' : 'Protected'}</a>
  </div>
</nav>

<main class="container">
  {@render children()}
</main>
