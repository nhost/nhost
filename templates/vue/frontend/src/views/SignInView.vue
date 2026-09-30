<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/lib/nhost/auth';

const { nhost } = useAuth();
const router = useRouter();

const email = ref('');
const otp = ref('');
const sent = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);

async function sendCode(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    await nhost.auth.signInOTPEmail({ email: email.value });
    sent.value = true;
  } catch (err) {
    error.value = `Could not send the code: ${(err as Error).message}`;
  } finally {
    loading.value = false;
  }
}

async function verify(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const response = await nhost.auth.verifySignInOTPEmail({
      email: email.value,
      otp: otp.value,
    });
    if (response.body?.session) {
      router.push('/protected');
    } else {
      error.value = 'Invalid or expired code. Please try again.';
    }
  } catch (err) {
    error.value = `Could not verify the code: ${(err as Error).message}`;
  } finally {
    loading.value = false;
  }
}

function onSubmit(): void {
  if (sent.value) {
    void verify();
  } else {
    void sendCode();
  }
}
</script>

<template>
  <div class="stack">
    <h1>Sign in</h1>
    <p class="muted">
      Enter your email and we'll send a one-time code. While running locally, the
      email with the code is captured by the local mail viewer.
    </p>

    <form class="card stack" @submit.prevent="onSubmit">
      <label v-if="sent" class="field">
        <span>Code sent to {{ email }}</span>
        <input
          v-model="otp"
          inputmode="numeric"
          placeholder="123456"
          autocomplete="one-time-code"
        />
      </label>
      <label v-else class="field">
        <span>Email</span>
        <input
          v-model="email"
          type="email"
          placeholder="you@example.com"
          autocomplete="email"
          required
        />
      </label>

      <button
        class="button"
        type="submit"
        :disabled="loading || (sent ? !otp : !email)"
      >
        {{ loading ? 'Working…' : sent ? 'Verify' : 'Send code' }}
      </button>

      <p v-if="error" class="error">{{ error }}</p>
    </form>
  </div>
</template>
