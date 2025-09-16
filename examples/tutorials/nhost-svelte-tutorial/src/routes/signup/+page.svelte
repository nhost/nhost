<script lang="ts">
  import type { ErrorResponse } from "@nhost/nhost-js/auth";
  import type { FetchError } from "@nhost/nhost-js/fetch";
  import { goto } from "$app/navigation";
  import { auth, nhost } from "$lib/nhost/auth";

  let email = $state("");
  let password = $state("");
  let displayName = $state("");
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);

  // If already authenticated, redirect to profile
  $effect(() => {
    if ($auth.isAuthenticated) {
      void goto("/profile");
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    isLoading = true;
    error = null;
    success = false;

    try {
      const response = await nhost.auth.signUpEmailPassword({
        email,
        password,
        options: {
          displayName,
          // Set the redirect URL for email verification
          redirectTo: `${window.location.origin}/verify`,
        },
      });

      if (response.body?.session) {
        // Successfully signed up and automatically signed in
        void goto("/profile");
      } else {
        // Verification email sent
        success = true;
      }
    } catch (err) {
      const fetchError = err as FetchError<ErrorResponse>;
      error = `An error occurred during sign up: ${fetchError.message}`;
    } finally {
      isLoading = false;
    }
  }
</script>

{#if success}
  <div>
    <h1>Check Your Email</h1>
    <div class="success-message">
      <p>
        We've sent a verification link to <strong>{email}</strong>
      </p>
      <p>
        Please check your email and click the verification link to activate your account.
      </p>
    </div>
    <p>
      <a href="/signin">Back to Sign In</a>
    </p>
  </div>
{:else}
  <div>
    <h1>Sign Up</h1>

    <form onsubmit={handleSubmit} class="auth-form">
      <div class="auth-form-field">
        <label for="displayName">Display Name</label>
        <input
          id="displayName"
          type="text"
          bind:value={displayName}
          required
          class="auth-input"
        />
      </div>

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
          minlength="8"
          class="auth-input"
        />
        <small class="help-text">Minimum 8 characters</small>
      </div>

      {#if error}
        <div class="auth-error">
          {error}
        </div>
      {/if}

      <button
        type="submit"
        disabled={isLoading}
        class="auth-button primary"
      >
        {isLoading ? "Creating Account..." : "Sign Up"}
      </button>
    </form>

    <div class="auth-links">
      <p>
        Already have an account? <a href="/signin">Sign In</a>
      </p>
    </div>
  </div>
{/if}
