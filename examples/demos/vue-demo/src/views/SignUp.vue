<template>
  <div class="flex flex-col items-center justify-center">
    <h1 class="text-3xl mb-6 gradient-text">Nhost SDK Demo</h1>

    <div class="glass-card w-full p-8 mb-6">
      <h2 class="text-2xl mb-6">Sign Up</h2>

      <TabForm>
        <template #password>
          <form @submit.prevent="handleSubmit" class="space-y-5">
            <div>
              <label for="displayName">Display Name</label>
              <input id="displayName" type="text" v-model="displayName" />
            </div>

            <div>
              <label for="email">Email</label>
              <input id="email" type="email" v-model="email" required />
            </div>

            <div>
              <label for="password">Password</label>
              <input
                id="password"
                type="password"
                v-model="password"
                required
              />
              <p class="text-xs mt-1 text-gray-400">
                Password must be at least 8 characters long
              </p>
            </div>

            <div v-if="error" class="alert alert-error">{{ error }}</div>

            <button
              type="submit"
              class="btn btn-primary w-full"
              :disabled="isLoading"
            >
              {{ isLoading ? "Signing Up..." : "Sign Up" }}
            </button>
          </form>
        </template>

        <template #magic>
          <div>
            <MagicLinkForm buttonLabel="Sign up with Magic Link" />
          </div>
        </template>

        <template #social>
          <div class="text-center">
            <p class="mb-6">Sign up using your Social account</p>
            <button
              type="button"
              @click="handleSocialSignIn('github')"
              class="btn btn-secondary w-full flex items-center justify-center gap-2"
              :disabled="isLoading"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                />
              </svg>
              Continue with GitHub
            </button>
          </div>
        </template>

        <template #webauthn>
          <WebAuthnSignUpForm
            v-model:email="email"
            v-model:displayName="displayName"
          />
        </template>
      </TabForm>
    </div>

    <div class="mt-4">
      <p>
        Already have an account? <router-link to="/signin">Sign In</router-link>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import TabForm from "../components/forms/TabForm.vue";
import MagicLinkForm from "../components/forms/MagicLinkForm.vue";
import WebAuthnSignUpForm from "../components/forms/WebAuthnSignUpForm.vue";
import { useAuth } from "../lib/nhost/auth";
import { type ErrorResponse } from "@nhost/nhost-js/auth";
import { type FetchError } from "@nhost/nhost-js/fetch";

const { nhost, isAuthenticated } = useAuth();
const router = useRouter();

const email = ref<string>("");
const password = ref<string>("");
const displayName = ref<string>("");
const isLoading = ref<boolean>(false);
const error = ref<string | null>(null);

// If already authenticated, redirect to profile
onMounted(() => {
  if (isAuthenticated.value) {
    router.push("/profile");
  }
});

const handleSubmit = async (): Promise<void> => {
  isLoading.value = true;
  error.value = null;

  try {
    const response = await nhost.auth.signUpEmailPassword({
      email: email.value,
      password: password.value,
      options: {
        displayName: displayName.value,
      },
    });

    if (response.body) {
      // Successfully signed up and automatically signed in
      router.push("/profile");
    } else {
      // Verification email sent
      router.push("/verify");
    }
  } catch (err) {
    const errorObj = err as FetchError<ErrorResponse>;
    error.value = `An error occurred during sign up: ${errorObj.message}`;
  } finally {
    isLoading.value = false;
  }
};

const handleSocialSignIn = (provider: "github") => {
  // Get the current origin (to build the redirect URL)
  const origin = window.location.origin;
  const redirectUrl = `${origin}/verify`;

  // Sign in with the specified provider
  const url = nhost.auth.signInProviderURL(provider, {
    redirectTo: redirectUrl,
  });

  window.location.href = url;
};
</script>
