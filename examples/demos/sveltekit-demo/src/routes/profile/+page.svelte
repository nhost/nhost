<script lang="ts">
import type { ErrorResponse } from "@nhost/nhost-js/auth";
import type { FetchError, FetchResponse } from "@nhost/nhost-js/fetch";
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import ChangePassword from "$lib/components/ChangePassword.svelte";
import MFASettings from "$lib/components/MFASettings.svelte";
import SecurityKeys from "$lib/components/SecurityKeys.svelte";
import { auth, nhost } from "$lib/nhost/auth";

interface MfaStatusResponse {
  data?: {
    user?: {
      activeMfaType: string | null;
    };
  };
}

let isMfaEnabled = $state(false);

// Redirect if not authenticated
$effect(() => {
  if (!$auth.isLoading && !$auth.isAuthenticated) {
    void goto("/signin");
  }
});

// Fetch MFA status when user is authenticated
onMount(async () => {
  if (!$auth.user?.id) return;

  try {
    // Correctly structure GraphQL query with parameters
    const response: FetchResponse<MfaStatusResponse> =
      await nhost.graphql.request({
        query: `
            query GetUserMfaStatus($userId: uuid!) {
              user(id: $userId) {
                activeMfaType
              }
            }
          `,
        variables: {
          userId: $auth.user.id,
        },
      });

    const userData = response.body?.data;
    const activeMfaType = userData?.user?.activeMfaType;
    isMfaEnabled = activeMfaType === "totp";
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    console.error(`Failed to query MFA status: ${error.message}`);
  }
});
</script>

{#if $auth.isLoading}
  <div class="loading-container">Loading...</div>
{:else if $auth.isAuthenticated}
  <div class="flex flex-col">
    <h1 class="text-3xl mb-6 gradient-text">Your Profile</h1>

    <div class="glass-card p-8 mb-6">
      <div class="space-y-5">
        <div class="profile-item">
          <strong>Display Name:</strong>
          <span class="ml-2">{$auth.user?.displayName || "Not set"}</span>
        </div>

        <div class="profile-item">
          <strong>Email:</strong>
          <span class="ml-2">{$auth.user?.email || "Not available"}</span>
        </div>

        <div class="profile-item">
          <strong>User ID:</strong>
          <span
            class="ml-2"
            style="font-family: var(--font-geist-mono); font-size: 0.875rem;"
          >
            {$auth.user?.id || "Not available"}
          </span>
        </div>

        <div class="profile-item">
          <strong>Roles:</strong>
          <span class="ml-2">{$auth.user?.roles?.join(", ") || "None"}</span>
        </div>

        <div class="profile-item">
          <strong>Email Verified:</strong>
          <span class="ml-2">{$auth.user?.emailVerified ? "Yes" : "No"}</span>
        </div>

        <div class="profile-item">
          <strong>MFA Enabled:</strong>
          <span class="ml-2">{isMfaEnabled ? "Yes" : "No"}</span>
        </div>
      </div>
    </div>

    <div class="glass-card p-8 mb-6">
      <h3 class="text-xl mb-4">Session Information</h3>
      <pre>{JSON.stringify($auth.session, null, 2)}</pre>
    </div>

    <MFASettings initialMfaEnabled={isMfaEnabled} />

    <SecurityKeys />

    <ChangePassword />
  </div>
{:else}
  <div class="text-center">
    <h2 class="text-xl mb-4">Access Denied</h2>
    <p>You must be signed in to view this page.</p>
  </div>
{/if}
