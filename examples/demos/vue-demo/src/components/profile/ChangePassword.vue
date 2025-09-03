<template>
  <div class="glass-card p-8 mb-6">
    <h3 class="text-xl mb-4">Change Password</h3>

    <div v-if="success" class="alert alert-success mb-4">
      Password changed successfully!
    </div>

    <div v-if="error" class="alert alert-error mb-4">{{ error }}</div>

    <form @submit.prevent="handleSubmit">
      <div class="mb-4">
        <label for="new-password" class="block text-sm font-medium mb-1">
          New Password
        </label>
        <input
          id="new-password"
          type="password"
          v-model="newPassword"
          class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
          minlength="3"
          :disabled="isLoading"
        />
      </div>

      <div class="mb-6">
        <label for="confirm-password" class="block text-sm font-medium mb-1">
          Confirm Password
        </label>
        <input
          id="confirm-password"
          type="password"
          v-model="confirmPassword"
          class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
          :disabled="isLoading"
        />
      </div>

      <button
        type="submit"
        :disabled="isLoading"
        class="btn btn-primary w-full"
      >
        {{ isLoading ? "Updating..." : "Change Password" }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { type ErrorResponse } from "@nhost/nhost-js/auth";
import { type FetchError } from "@nhost/nhost-js/fetch";
import { ref } from "vue";
import { useAuth } from "../../lib/nhost/auth";

const { nhost } = useAuth();

const newPassword = ref<string>("");
const confirmPassword = ref<string>("");
const isLoading = ref<boolean>(false);
const error = ref<string>("");
const success = ref<boolean>(false);

const handleSubmit = async (): Promise<void> => {
  // Reset states
  error.value = "";
  success.value = false;

  // Validate passwords
  if (newPassword.value.length < 3) {
    error.value = "Password must be at least 3 characters long";
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    error.value = "Passwords do not match";
    return;
  }

  isLoading.value = true;

  try {
    // Use the changeUserPassword method from the SDK
    await nhost.auth.changeUserPassword({
      newPassword: newPassword.value,
    });
    success.value = true;
    newPassword.value = "";
    confirmPassword.value = "";
  } catch (err) {
    const errorObj = err as FetchError<ErrorResponse>;
    error.value = `An error occurred while changing the password: ${errorObj.message}`;
  } finally {
    isLoading.value = false;
  }
};
</script>
