<script lang="ts">
import { goto } from "$app/navigation";
import { auth } from "$lib/nhost/auth";

// Redirect if not authenticated
$effect(() => {
  if (!$auth.isLoading && !$auth.isAuthenticated) {
    void goto("/");
  }
});
</script>

{#if $auth.isLoading}
  <div class="loading-container">
    <div class="loading-content">
      <div class="spinner"></div>
      <span class="loading-text">Loading...</span>
    </div>
  </div>
{:else if $auth.isAuthenticated}
  <div class="container">
    <header class="page-header">
      <h1 class="page-title">Your Profile</h1>
    </header>

    <div class="form-card">
      <h3 class="form-title">User Information</h3>
      <div class="form-fields">
        <div class="field-group">
          <strong>Display Name:</strong> {$auth.user?.displayName || "Not set"}
        </div>
        <div class="field-group">
          <strong>Email:</strong> {$auth.user?.email || "Not available"}
        </div>
        <div class="field-group">
          <strong>User ID:</strong> {$auth.user?.id || "Not available"}
        </div>
        <div class="field-group">
          <strong>Roles:</strong> {$auth.user?.roles?.join(", ") || "None"}
        </div>
        <div class="field-group">
          <strong>Email Verified:</strong>
          <span class={$auth.user?.emailVerified ? 'email-verified' : 'email-unverified'}>
            {$auth.user?.emailVerified ? "✓ Yes" : "✗ No"}
          </span>
        </div>
      </div>
    </div>

    <div class="form-card">
      <h3 class="form-title">Session Information</h3>
      <div class="description">
        <pre class="session-display">{JSON.stringify($auth.session, null, 2)}</pre>
      </div>
    </div>
  </div>
{:else}
  <div class="container">
    <div class="page-center">
      <h2>Access Denied</h2>
      <p>You must be signed in to view this page.</p>
    </div>
  </div>
{/if}
