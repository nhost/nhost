<script lang="ts">
  import type { ErrorResponse } from "@nhost/nhost-js/auth";
  import type { FetchError } from "@nhost/nhost-js/fetch";
  import { goto } from "$app/navigation";
  import { auth, nhost } from "$lib/nhost/auth";

  let email = $state("");
  let password = $state("");
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // Navigate to profile when authenticated
  $effect(() => {
    if ($auth.isAuthenticated) {
      void goto("/profile");
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    isLoading = true;
    error = null;

    try {
      // Use the signIn function from auth context
      const response = await nhost.auth.signInEmailPassword({
        email,
        password,
      });

      // If we have a session, sign in was successful
      if (response.body?.session) {
        void goto("/profile");
      } else {
        error = "Failed to sign in. Please check your credentials.";
      }
    } catch (err) {
      const fetchError = err as FetchError<ErrorResponse>;
      error = `An error occurred during sign in: ${fetchError.message}`;
    } finally {
      isLoading = false;
    }
  }
</script>

<div>
  <h1>Sign In</h1>

  <form onsubmit={handleSubmit} class="auth-form">
    <div class="auth-form-field">
      <label for="email">Email</label>
      <input
        id="email"
        type="email"
        bind:value={email}
        required
        class="auth-input"
      />
    </div>

    <div class="auth-form-field">
      <label for="password">Password</label>
      <input
        id="password"
        type="password"
        bind:value={password}
        required
        class="auth-input"
      />
    </div>

    {#if error}
      <div class="auth-error">
        {error}
      </div>
    {/if}

    <button
      type="submit"
      disabled={isLoading}
      class="auth-button secondary"
    >
      {isLoading ? "Signing In..." : "Sign In"}
    </button>
  </form>

  <div class="auth-links">
    <p>
      Don't have an account? <a href="/signup">Sign Up</a>
    </p>
  </div>
</div>
