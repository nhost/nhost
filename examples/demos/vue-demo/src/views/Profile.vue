<template>
  <div class="flex flex-col">
    <h1 class="text-3xl mb-6 gradient-text">Your Profile</h1>

    <div class="glass-card p-8 mb-6">
      <div class="space-y-5">
        <div class="profile-item">
          <strong>Display Name:</strong>
          <span class="ml-2">{{ user?.displayName || "Not set" }}</span>
        </div>

        <div class="profile-item">
          <strong>Email:</strong>
          <span class="ml-2">{{ user?.email || "Not available" }}</span>
        </div>

        <div class="profile-item">
          <strong>User ID:</strong>
          <span
            class="ml-2"
            style="font-family: var(--font-geist-mono); font-size: 0.875rem"
          >
            {{ user?.id || "Not available" }}
          </span>
        </div>

        <div class="profile-item">
          <strong>Roles:</strong>
          <span class="ml-2">{{ user?.roles?.join(", ") || "None" }}</span>
        </div>

        <div class="profile-item">
          <strong>Email Verified:</strong>
          <span class="ml-2">{{ user?.emailVerified ? "Yes" : "No" }}</span>
        </div>
      </div>
    </div>

    <div class="glass-card p-8 mb-6">
      <h3 class="text-xl mb-4">Session Information</h3>
      <pre>{{ JSON.stringify(session, null, 2) }}</pre>
    </div>

    <MFASettings
      :key="`mfa-settings-${isMfaEnabled}`"
      :initialMfaEnabled="isMfaEnabled"
    />

    <SecurityKeys />

    <ChangePassword />
  </div>
</template>

<script setup lang="ts">
import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError, FetchResponse } from '@nhost/nhost-js/fetch';
import { onMounted, ref } from 'vue';
import ChangePassword from '../components/profile/ChangePassword.vue';
import MFASettings from '../components/profile/MFASettings.vue';
import SecurityKeys from '../components/profile/SecurityKeys.vue';
import { useAuth } from '../lib/nhost/auth';

interface MfaStatusResponse {
  data?: {
    user?: {
      activeMfaType: string | null;
    };
  };
}

const { nhost, user, session, isAuthenticated } = useAuth();
const isMfaEnabled = ref<boolean>(false);

// Fetch MFA status when user is authenticated
onMounted(async () => {
  const fetchMfaStatus = async (): Promise<void> => {
    if (!user.value?.id) return;

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
            userId: user.value.id,
          },
        });

      const userData = response.body?.data;
      const activeMfaType = userData?.user?.activeMfaType;
      const newMfaEnabled = activeMfaType === 'totp';

      // Update the state
      isMfaEnabled.value = newMfaEnabled;
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      console.error(`Failed to query MFA status: ${error.message}`);
    }
  };

  if (isAuthenticated.value && user.value?.id) {
    await fetchMfaStatus();
  }
});
</script>
