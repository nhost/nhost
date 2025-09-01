<script lang="ts">
  import { nhost } from "$lib/nhost/auth";
  import type { ErrorResponse } from "@nhost/nhost-js/auth";
  import type { FetchError } from "@nhost/nhost-js/fetch";

  let newPassword = $state("");
  let confirmPassword = $state("");
  let isLoading = $state(false);
  let error = $state("");
  let success = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();

    // Reset states
    error = "";
    success = false;

    // Validate passwords
    if (newPassword.length < 3) {
      error = "Password must be at least 3 characters long";
      return;
    }

    if (newPassword !== confirmPassword) {
      error = "Passwords do not match";
      return;
    }

    isLoading = true;

    try {
      // Use the changeUserPassword method from the SDK
      await nhost.auth.changeUserPassword({
        newPassword,
      });
      success = true;
      newPassword = "";
      confirmPassword = "";
    } catch (err) {
      const fetchError = err as FetchError<ErrorResponse>;
      error = `An error occurred while changing the password: ${fetchError.message}`;
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="glass-card p-8 mb-6">
  <h3 class="text-xl mb-4">Change Password</h3>

  {#if success}
    <div class="alert alert-success mb-4">Password changed successfully!</div>
  {/if}

  {#if error}
    <div class="alert alert-error mb-4">{error}</div>
  {/if}

  <form onsubmit={handleSubmit}>
    <div class="mb-4">
      <label for="new-password" class="block text-sm font-medium mb-1">
        New Password
      </label>
      <input
        id="new-password"
        type="password"
        bind:value={newPassword}
        required
        minlength="3"
        disabled={isLoading}
      />
    </div>

    <div class="mb-6">
      <label for="confirm-password" class="block text-sm font-medium mb-1">
        Confirm Password
      </label>
      <input
        id="confirm-password"
        type="password"
        bind:value={confirmPassword}
        required
        disabled={isLoading}
      />
    </div>

    <button type="submit" disabled={isLoading} class="btn btn-primary w-full">
      {isLoading ? "Updating..." : "Change Password"}
    </button>
  </form>
</div>
