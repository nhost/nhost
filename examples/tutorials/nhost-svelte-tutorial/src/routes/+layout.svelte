<script lang="ts">
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import { auth, initializeAuth, nhost } from "$lib/nhost/auth";
import "../app.css";

let { children }: { children?: import("svelte").Snippet } = $props();

// Initialize auth when component mounts
onMount(() => {
  return initializeAuth();
});

// Helper function to determine if a link is active
function isActive(path: string): string {
  return $page.url.pathname === path ? "nav-link active" : "nav-link";
}

async function handleSignOut() {
  if ($auth.session) {
    await nhost.auth.signOut({
      refreshToken: $auth.session.refreshToken,
    });
    void goto("/");
  }
}
</script>

<div id="root">
  <nav class="navigation">
    <div class="nav-container">
      <a href="/" class="nav-logo">Nhost SvelteKit Demo</a>

      <div class="nav-links">
        <a href="/" class="nav-link">Home</a>

        {#if $auth.isAuthenticated}
          <a href="/profile" class={isActive('/profile')}>Profile</a>
          <button
            onclick={handleSignOut}
            class="nav-link nav-button"
          >
            Sign Out
          </button>
        {:else}
          <a href="/signin" class="nav-link {isActive('/signin')}">
            Sign In
          </a>
          <a href="/signup" class="nav-link {isActive('/signup')}">
            Sign Up
          </a>
        {/if}
      </div>
    </div>
  </nav>

  <div class="app-content">
    {#if children}
      {@render children()}
    {/if}
  </div>
</div>
