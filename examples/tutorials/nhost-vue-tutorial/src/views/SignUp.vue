<template>
  <div>
    <h1 v-if="!success">Sign Up</h1>
    <h1 v-else>Check Your Email</h1>

    <div v-if="success" class="success-message">
      <p>
        We've sent a verification link to <strong>{{ email }}</strong>
      </p>
      <p>
        Please check your email and click the verification link to activate your account.
      </p>
      <p>
        <router-link to="/signin">Back to Sign In</router-link>
      </p>
    </div>

    <form v-else @submit.prevent="handleSubmit" class="auth-form">
      <div class="auth-form-field">
        <label :for="displayNameId">Display Name</label>
        <input
          :id="displayNameId"
          type="text"
          v-model="displayName"
          required
          class="auth-input"
        />
      </div>

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
          minlength="8"
          class="auth-input"
        />
        <small class="help-text">Minimum 8 characters</small>
      </div>

      <div v-if="error" class="auth-error">
        {{ error }}
      </div>

      <button
        type="submit"
        :disabled="isLoading"
        class="auth-button primary"
      >
        {{ isLoading ? "Creating Account..." : "Sign Up" }}
      </button>
    </form>

    <div v-if="!success" class="auth-links">
      <p>
        Already have an account? <router-link to="/signin">Sign In</router-link>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, useId } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../lib/nhost/auth";

const { nhost, isAuthenticated } = useAuth();
const router = useRouter();

const email = ref("");
const password = ref("");
const displayName = ref("");
const isLoading = ref(false);
const error = ref<string | null>(null);
const success = ref(false);

const displayNameId = useId();
const emailId = useId();
const passwordId = useId();

// Redirect authenticated users to profile
onMounted(() => {
  if (isAuthenticated.value) {
    router.push("/profile");
  }
});

const handleSubmit = async () => {
  isLoading.value = true;
  error.value = null;
  success.value = false;

  try {
    const response = await nhost.auth.signUpEmailPassword({
      email: email.value,
      password: password.value,
      options: {
        displayName: displayName.value,
        // Set the redirect URL for email verification
        redirectTo: `${window.location.origin}/verify`,
      },
    });

    if (response.body?.session) {
      // Successfully signed up and automatically signed in
      router.push("/profile");
    } else {
      // Verification email sent
      success.value = true;
    }
  } catch (err) {
    const message = (err as Error).message || "Unknown error";
    error.value = `An error occurred during sign up: ${message}`;
  } finally {
    isLoading.value = false;
  }
};
</script>
