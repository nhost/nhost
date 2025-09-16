<script lang="ts">
  import type { ErrorResponse } from "@nhost/nhost-js/auth";
  import type { FetchError } from "@nhost/nhost-js/fetch";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { nhost } from "$lib/nhost/auth";

  let status: "verifying" | "success" | "error" = "verifying";
  let error = "";
  let urlParams: Record<string, string> = {};

  onMount(() => {
    // Extract the refresh token from the URL
    const params = new URLSearchParams($page.url.search);
    const refreshToken = params.get("refreshToken");

    if (!refreshToken) {
      // Collect all URL parameters to display for debugging
      const allParams: Record<string, string> = {};
      params.forEach((value, key) => {
        allParams[key] = value;
      });
      urlParams = allParams;

      status = "error";
      error = "No refresh token found in URL";
      return;
    }

    // Flag to handle component unmounting during async operations
    let isMounted = true;

    async function processToken() {
      try {
        // First display the verifying message for at least a moment
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (!isMounted) return;

        if (!refreshToken) {
          // Collect all URL parameters to display
          const allParams: Record<string, string> = {};
          params.forEach((value, key) => {
            allParams[key] = value;
          });
          urlParams = allParams;

          status = "error";
          error = "No refresh token found in URL";
          return;
        }

        // Process the token
        await nhost.auth.refreshToken({ refreshToken });

        if (!isMounted) return;

        status = "success";

        // Wait to show success message briefly, then redirect
        setTimeout(() => {
          if (isMounted) void goto("/profile");
        }, 1500);
      } catch (err) {
        const fetchError = err as FetchError<ErrorResponse>;
        if (!isMounted) return;

        status = "error";
        error = `An error occurred during verification: ${fetchError.message}`;
      }
    }

    void processToken();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  });
</script>

<div>
  <h1>Email Verification</h1>

  <div class="page-center">
    {#if status === "verifying"}
      <div>
        <p class="margin-bottom">Verifying your email...</p>
        <div class="spinner-verify" />
      </div>
    {/if}

    {#if status === "success"}
      <div>
        <p class="verification-status">
          ✓ Successfully verified!
        </p>
        <p>You'll be redirected to your profile page shortly...</p>
      </div>
    {/if}

    {#if status === "error"}
      <div>
        <p class="verification-status error">
          Verification failed
        </p>
        <p class="margin-bottom">{error}</p>

        {#if Object.keys(urlParams).length > 0}
          <div class="debug-panel">
            <p class="debug-title">
              URL Parameters:
            </p>
            {#each Object.entries(urlParams) as [key, value] (key)}
              <div class="debug-item">
                <span class="debug-key">
                  {key}:
                </span>
                <span class="debug-value">{value}</span>
              </div>
            {/each}
          </div>
        {/if}

        <button
          type="button"
          onclick={() => goto("/signin")}
          class="auth-button secondary"
        >
          Back to Sign In
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .spinner-verify {
    width: 2rem;
    height: 2rem;
    border: 2px solid transparent;
    border-top: 2px solid var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto;
  }
</style>
