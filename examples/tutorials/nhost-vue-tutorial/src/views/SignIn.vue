<template>
  <div>
    <h1>Sign In</h1>

    <form @submit.prevent="handleSubmit" class="auth-form">
      <div class="auth-form-field">
        <label :for="emailId">Email</label>
        <input
          :id="emailId"
          type="email"
          v-model="email"
          required
          class="auth-input"
        />
      </div>

      <div class="auth-form-field">
        <label :for="passwordId">Password</label>
        <input
          :id="passwordId"
          type="password"
          v-model="password"
          required
          class="auth-input"
        />
      </div>

      <div v-if="error" class="auth-error">
        {{ error }}
      </div>

      <button
        type="submit"
        :disabled="isLoading"
        class="auth-button secondary"
      >
        {{ isLoading ? "Signing In..." : "Sign In" }}
      </button>
    </form>

    <div class="auth-links">
      <p>
        Don't have an account? <router-link to="/signup">Sign Up</router-link>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, useId } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../lib/nhost/auth";

const { nhost, isAuthenticated } = useAuth();
const router = useRouter();

const email = ref("");
const password = ref("");
const isLoading = ref(false);
const error = ref<string | null>(null);

const emailId = useId();
const passwordId = useId();

// Use onMounted for navigation after authentication is confirmed
onMounted(() => {
  if (isAuthenticated.value) {
    router.push("/profile");
  }
});

const handleSubmit = async () => {
  isLoading.value = true;
  error.value = null;

  try {
    // Use the signIn function from auth context
    const response = await nhost.auth.signInEmailPassword({
      email: email.value,
      password: password.value,
    });

    // If we have a session, sign in was successful
    if (response.body?.session) {
      router.push("/profile");
    } else {
      error.value = "Failed to sign in. Please check your credentials.";
    }
  } catch (err) {
    const message = (err as Error).message || "Unknown error";
    error.value = `An error occurred during sign in: ${message}`;
  } finally {
    isLoading.value = false;
  }
};
</script>
