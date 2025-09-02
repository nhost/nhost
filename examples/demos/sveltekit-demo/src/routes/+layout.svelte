<script lang="ts">
import { onMount } from "svelte";
import { page } from "$app/stores";
import { goto } from "$app/navigation";
import { initializeAuth, auth, nhost } from "$lib/nhost/auth";
import "../app.css";

let { children }: { children?: import("svelte").Snippet } = $props();

// Initialize auth when component mounts
onMount(() => {
  return initializeAuth();
});

// Helper function to determine if a link is active
function isActive(path: string): string {
  return $page.url.pathname === path ? "active" : "";
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

<div class="flex-col min-h-screen">
  <nav class="navbar">
    <div class="navbar-container">
      <div class="flex items-center">
        <span class="navbar-brand">Nhost Demo</span>
        <div class="navbar-links">
          {#if $auth.isAuthenticated}
            <a href="/profile" class="nav-link {isActive('/profile')}">
              Profile
            </a>
            <a href="/upload" class="nav-link {isActive('/upload')}">
              Upload
            </a>
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

      {#if $auth.isAuthenticated}
        <div>
          <button
            onclick={handleSignOut}
            class="icon-button"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      {/if}
    </div>
  </nav>

  <main class="max-w-2xl mx-auto p-6 w-full">
    {#if children}
      {@render children()}
    {/if}
  </main>

  <footer>
    <p class="text-sm text-center" style="color: var(--text-muted)">
      © {new Date().getFullYear()} Nhost Demo
    </p>
  </footer>
</div>
