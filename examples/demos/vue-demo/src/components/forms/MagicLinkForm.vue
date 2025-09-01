<template>
  <div v-if="success" class="text-center">
    <p class="mb-4">Magic link sent! Check your email to sign in.</p>
    <button @click="success = false" class="btn btn-secondary">
      Try again
    </button>
  </div>
  <form v-else @submit.prevent="handleSubmit" class="space-y-5">
    <div>
      <label for="magic-email">Email</label>
      <input id="magic-email" type="email" v-model="email" required />
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <button type="submit" class="btn btn-primary w-full" :disabled="isLoading">
      {{ isLoading ? "Sending..." : buttonLabel }}
    </button>
  </form>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useAuth } from "../../lib/nhost/auth";
import type { ErrorResponse } from "@nhost/nhost-js/auth";
import { type FetchError } from "@nhost/nhost-js/fetch";

interface Props {
  buttonLabel?: string;
}

withDefaults(defineProps<Props>(), {
  buttonLabel: "Send Magic Link",
});

const { nhost } = useAuth();

const email = ref<string>("");
const isLoading = ref<boolean>(false);
const success = ref<boolean>(false);
const error = ref<string | null>(null);

const handleSubmit = async () => {
  isLoading.value = true;
  error.value = null;

  try {
    await nhost.auth.signInPasswordlessEmail({
      email: email.value,
      options: {
        redirectTo: `${window.location.origin}/verify`,
      },
    });

    success.value = true;
  } catch (err) {
    const errorObj = err as FetchError<ErrorResponse>;
    error.value = `An error occurred while sending the magic link: ${errorObj.message}`;
  } finally {
    isLoading.value = false;
  }
};
</script>
