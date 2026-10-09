<script setup lang="ts">
import { ref, useId } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { requestPasswordReset, signIn, signUp } from '@/auth/password/actions';
import CheckYourInbox from '@/components/CheckYourInbox.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/nhost/auth';
import type { Intent } from '@/signin/intent';
import { signInQuery } from '@/signin/query';

const props = defineProps<{
  next: string;
  intent: Intent;
  mailboxUrl: string | null;
}>();

type Mode = 'sign-in' | 'sign-up';

// What the form shows once a request has gone out and there is nothing more
// to type: the next step happens in the visitor's inbox.
type Sent = 'verification' | 'reset';

const { nhost } = useAuth();
const route = useRoute();
const router = useRouter();
const emailId = useId();
const passwordId = useId();

// Opens on whatever the link that sent them here asked for, which is sign-up
// unless it said otherwise: a fresh local backend has no accounts in it, so a
// sign-in form would be a dead end.
const mode = ref<Mode>(props.intent);
const email = ref('');
const password = ref('');
const sent = ref<Sent | undefined>();
const error = ref<string | undefined>();
const isPending = ref(false);

const switchMode = (): void => {
  mode.value = mode.value === 'sign-in' ? 'sign-up' : 'sign-in';
  error.value = undefined;
  // "Other ways to sign in" is built from the URL, so the URL has to say which
  // mode the visitor switched to.
  void router.replace(`${route.path}${signInQuery(props.next, mode.value)}`);
};

const handleSubmit = async (): Promise<void> => {
  error.value = undefined;
  isPending.value = true;
  try {
    if (mode.value === 'sign-in') {
      const result = await signIn(nhost, email.value, password.value);
      if (result.error) {
        error.value = result.error;
        return;
      }

      await router.push(props.next);
      return;
    }

    const result = await signUp(nhost, email.value, password.value, props.next);
    if (result.error) {
      error.value = result.error;
      return;
    }

    if (result.signedIn) {
      await router.push(props.next);
      return;
    }

    sent.value = 'verification';
  } catch (err) {
    console.error('Error submitting the form:', err);
    error.value = 'The request did not reach the server. Try again.';
  } finally {
    isPending.value = false;
  }
};

const handleForgotPassword = async (): Promise<void> => {
  error.value = undefined;
  isPending.value = true;
  try {
    const result = await requestPasswordReset(nhost, email.value);
    if (result.error) {
      error.value = result.error;
      return;
    }

    sent.value = 'reset';
  } catch (err) {
    console.error('Error requesting the reset link:', err);
    error.value = 'The request did not reach the server. Try again.';
  } finally {
    isPending.value = false;
  }
};
</script>

<template>
  <div v-if="sent === 'verification'" class="flex flex-col gap-2 text-sm">
    <CheckYourInbox :url="mailboxUrl" />
    <p class="text-muted-foreground">
      We sent a verification link to {{ email }}. Opening it confirms the
      address and signs you in.
    </p>
  </div>

  <div v-else-if="sent === 'reset'" class="flex flex-col gap-2 text-sm">
    <CheckYourInbox :url="mailboxUrl" />
    <p class="text-muted-foreground">
      If that address has an account, a reset link is on its way.
    </p>
  </div>

  <form v-else class="flex flex-col gap-4" @submit.prevent="handleSubmit">
    <div class="flex flex-col gap-2">
      <Label :for="emailId">Email</Label>
      <Input
        :id="emailId"
        v-model="email"
        type="email"
        autocomplete="email"
        required
        :disabled="isPending"
      />
    </div>

    <div class="flex flex-col gap-2">
      <Label :for="passwordId">Password</Label>
      <Input
        :id="passwordId"
        v-model="password"
        type="password"
        :autocomplete="
          mode === 'sign-in' ? 'current-password' : 'new-password'
        "
        required
        :disabled="isPending"
      />
    </div>

    <p v-if="error" role="alert" class="text-destructive text-sm">
      {{ error }}
    </p>

    <Button type="submit" :disabled="isPending">
      <template v-if="mode === 'sign-in'">
        {{ isPending ? 'Signing in…' : 'Sign in' }}
      </template>
      <template v-else>
        {{ isPending ? 'Signing up…' : 'Sign up' }}
      </template>
    </Button>

    <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
      <Button
        type="button"
        variant="link"
        size="sm"
        class="h-auto p-0"
        :disabled="isPending"
        @click="switchMode"
      >
        {{ mode === 'sign-in' ? 'Create an account' : 'I already have an account' }}
      </Button>
      <Button
        v-if="mode === 'sign-in'"
        type="button"
        variant="link"
        size="sm"
        class="h-auto p-0"
        :disabled="isPending || !email"
        @click="handleForgotPassword"
      >
        Forgot your password?
      </Button>
    </div>
  </form>
</template>
