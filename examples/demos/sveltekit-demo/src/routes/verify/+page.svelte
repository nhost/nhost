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

<svelte:head>
  <title>Email Verification - Nhost Demo</title>
</svelte:head>

<div class="flex flex-col items-center justify-center">
  <h1 class="text-3xl mb-6 gradient-text">Nhost SDK Demo</h1>

  <div class="glass-card w-full p-8 mb-6">
    <h2 class="text-2xl mb-6">Email Verification</h2>

    <div class="text-center py-4">
      {#if status === "verifying"}
        <div>
          <p class="mb-4">Verifying your email...</p>
          <div
            class="w-8 h-8 border-t-2 rounded-full animate-spin mx-auto"
            style="border-color: var(--primary);"
          ></div>
        </div>
      {/if}

      {#if status === "success"}
        <div>
          <p class="mb-4 font-bold" style="color: var(--success);">
            ✓ Successfully verified!
          </p>
          <p>You'll be redirected to your profile page shortly...</p>
        </div>
      {/if}

      {#if status === "error"}
        <div>
          <p class="mb-4 font-semibold" style="color: var(--error);">
            Verification failed
          </p>
          <p class="mb-4">{error}</p>

          {#if Object.keys(urlParams).length > 0}
            <div
              class="mb-4 p-4 rounded-md text-left overflow-auto max-h-48"
              style="background-color: rgba(31, 41, 55, 0.5);"
            >
              <p class="font-semibold mb-2">URL Parameters:</p>
              {#each Object.entries(urlParams) as [key, value] (key)}
                <div class="mb-1">
                  <span class="font-mono" style="color: var(--primary);"
                    >{key}:</span
                  >
                  <span class="font-mono ml-2">{value}</span>
                </div>
              {/each}
            </div>
          {/if}

          <button onclick={() => goto("/signin")} class="btn btn-primary">
            Back to Sign In
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }
</style>
