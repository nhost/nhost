<template>
  <div>
    <h1>Email Verification</h1>

    <div class="page-center">
      <div v-if="status === 'verifying'">
        <p class="margin-bottom">Verifying your email...</p>
        <div class="spinner-verify" />
      </div>

      <div v-else-if="status === 'success'">
        <p class="verification-status">
          ✓ Successfully verified!
        </p>
        <p>You'll be redirected to your profile page shortly...</p>
      </div>

      <div v-else-if="status === 'error'">
        <p class="verification-status error">
          Verification failed
        </p>
        <p class="margin-bottom">{{ error }}</p>

        <div v-if="Object.keys(urlParams).length > 0" class="debug-panel">
          <p class="debug-title">
            URL Parameters:
          </p>
          <div
            v-for="[key, value] in Object.entries(urlParams)"
            :key="key"
            class="debug-item"
          >
            <span class="debug-key">
              {{ key }}:
            </span>
            <span class="debug-value">{{ value }}</span>
          </div>
        </div>

        <button
          type="button"
          @click="router.push('/signin')"
          class="auth-button secondary"
        >
          Back to Sign In
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../lib/nhost/auth';

const route = useRoute();
const router = useRouter();
const { nhost } = useAuth();

const status = ref<'verifying' | 'success' | 'error'>('verifying');
const error = ref<string | null>(null);
const urlParams = ref<Record<string, string>>({});

// Flag to handle component unmounting during async operations
let isMounted = true;

onMounted(() => {
  // Extract the refresh token from the URL
  const params = new URLSearchParams(route.fullPath.split('?')[1] || '');
  const refreshToken = params.get('refreshToken');

  if (!refreshToken) {
    // Collect all URL parameters to display for debugging
    const allParams: Record<string, string> = {};
    params.forEach((value, key) => {
      allParams[key] = value;
    });
    urlParams.value = allParams;

    status.value = 'error';
    error.value = 'No refresh token found in URL';
    return;
  }

  processToken(refreshToken, params);
});

onUnmounted(() => {
  isMounted = false;
});

async function processToken(
  refreshToken: string,
  params: URLSearchParams,
): Promise<void> {
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
      urlParams.value = allParams;

      status.value = 'error';
      error.value = 'No refresh token found in URL';
      return;
    }

    // Process the token
    await nhost.auth.refreshToken({ refreshToken });

    if (!isMounted) return;

    status.value = 'success';

    // Wait to show success message briefly, then redirect
    setTimeout(() => {
      if (isMounted) router.push('/profile');
    }, 1500);
  } catch (err) {
    const message = (err as Error).message || 'Unknown error';
    if (!isMounted) return;

    status.value = 'error';
    error.value = `An error occurred during verification: ${message}`;
  }
}
</script>
