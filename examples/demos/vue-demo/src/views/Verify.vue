<template>
  <div class="flex flex-col items-center justify-center">
    <h1 class="text-3xl mb-6 gradient-text">Nhost SDK Demo</h1>

    <div class="glass-card w-full p-8 mb-6">
      <h2 class="text-2xl mb-6">Email Verification</h2>

      <div class="text-center py-4">
        <div v-if="status === 'verifying'">
          <p class="mb-4">Verifying your email...</p>
          <div
            class="w-8 h-8 border-t-2 border-blue-500 rounded-full animate-spin mx-auto"
          />
        </div>

        <div v-else-if="status === 'success'">
          <p class="mb-4 text-green-500 font-bold">✓ Successfully verified!</p>
          <p>You'll be redirected to your profile page shortly...</p>
        </div>

        <div v-else-if="status === 'error'">
          <p class="mb-4 text-red-500 font-semibold">Verification failed</p>
          <p class="mb-4">{{ error }}</p>

          <div
            v-if="Object.keys(urlParams).length > 0"
            class="mb-4 p-4 bg-gray-100 rounded-md text-left overflow-auto max-h-48"
          >
            <p class="font-semibold mb-2">URL Parameters:</p>
            <div
              v-for="[key, value] in Object.entries(urlParams)"
              :key="key"
              class="mb-1"
            >
              <span class="font-mono text-blue-600">{{ key }}:</span>
              <span class="font-mono"> {{ value }}</span>
            </div>
          </div>

          <button @click="router.push('/signin')" class="btn btn-primary">
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ErrorResponse } from "@nhost/nhost-js/auth";
import { type FetchError } from "@nhost/nhost-js/fetch";
import { onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuth } from "../lib/nhost/auth";

const route = useRoute();
const router = useRouter();
const { nhost } = useAuth();

const status = ref<"verifying" | "success" | "error">("verifying");
const error = ref<string>("");
const urlParams = ref<Record<string, string>>({});

// Flag to handle component unmounting during async operations
let isMounted = true;

onMounted(async () => {
  // Extract the refresh token from the URL
  const params = new URLSearchParams(route.fullPath.split("?")[1] || "");
  const refreshToken = params.get("refreshToken");

  if (!refreshToken) {
    // Collect all URL parameters to display
    const allParams: Record<string, string> = {};
    params.forEach((value, key) => {
      allParams[key] = value;
    });
    urlParams.value = allParams;

    status.value = "error";
    error.value = "No refresh token found in URL";
    return;
  }

  await processToken(refreshToken, params);
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

      status.value = "error";
      error.value = "No refresh token found in URL";
      return;
    }

    // Process the token
    await nhost.auth.refreshToken({ refreshToken });

    if (!isMounted) return;

    status.value = "success";

    // Wait to show success message briefly, then redirect
    setTimeout(() => {
      if (isMounted) router.push("/profile");
    }, 1500);
  } catch (err) {
    const errorObj = err as FetchError<ErrorResponse>;
    if (!isMounted) return;

    status.value = "error";
    error.value = `An error occurred during verification: ${errorObj.message}`;
  }
}
</script>

<style scoped>
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.w-8 {
  width: 2rem;
}

.h-8 {
  height: 2rem;
}

.border-t-2 {
  border-top-width: 2px;
}

.border-blue-500 {
  border-color: #3b82f6;
}

.rounded-full {
  border-radius: 9999px;
}

.mx-auto {
  margin-left: auto;
  margin-right: auto;
}

.text-green-500 {
  color: #22c55e;
}

.text-red-500 {
  color: #ef4444;
}

.font-bold {
  font-weight: 700;
}

.font-semibold {
  font-weight: 600;
}

.font-mono {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
}

.text-blue-600 {
  color: #2563eb;
}

.max-h-48 {
  max-height: 12rem;
}

.overflow-auto {
  overflow: auto;
}
</style>
