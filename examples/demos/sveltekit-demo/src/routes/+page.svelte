<script lang="ts">
import { goto } from "$app/navigation";
import { auth } from "$lib/nhost/auth";

// Redirect based on authentication status
$effect(() => {
  if (!$auth.isLoading) {
    if ($auth.isAuthenticated) {
      void goto("/profile");
    } else {
      void goto("/signin");
    }
  }
});
</script>

{#if $auth.isLoading}
  <div class="loading-container">Loading...</div>
{/if}
