<script setup lang="ts">
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import { ref, useId } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  beginSignIn,
  beginSignUp,
  finishSignIn,
  finishSignUp,
} from '@/app/auth/passkey/actions';
import { wasCancelled } from '@/app/auth/passkey/cancelled';
import { deviceName } from '@/app/auth/passkey/manage/names';
import { rememberPasskey } from '@/app/auth/passkey/thisDevice';
import type { Intent } from '@/app/signin/intent';
import { signInQuery } from '@/app/signin/query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Mode = 'sign-in' | 'sign-up';

const props = defineProps<{ next: string; intent: Intent }>();

const router = useRouter();
const route = useRoute();
const emailId = useId();

// Opens on whatever the link that sent them here asked for, which is sign-up
// unless it said otherwise: a fresh local backend has no accounts in it, so a
// sign-in form would be a dead end.
const mode = ref<Mode>(props.intent);
const email = ref('');
const sent = ref(false);
const error = ref<string>();
const isPending = ref(false);

function finishNavigation(): void {
  void router.push(props.next);
}

function switchMode(): void {
  const other = mode.value === 'sign-in' ? 'sign-up' : 'sign-in';
  mode.value = other;
  error.value = undefined;
  // "Other ways to sign in" is built from the URL, so the URL has to say which
  // mode the visitor switched to.
  void router.replace(`${route.path}${signInQuery(props.next, other)}`);
}

async function handleSubmit(): Promise<void> {
  error.value = undefined;

  if (!browserSupportsWebAuthn()) {
    error.value = 'This browser does not support passkeys.';
    return;
  }

  isPending.value = true;
  try {
    if (mode.value === 'sign-in') {
      const begun = await beginSignIn();
      if (begun.error || !begun.options) {
        error.value = begun.error ?? 'Could not start sign in.';
        return;
      }

      const credential = await startAuthentication({
        optionsJSON: begun.options,
      });
      const result = await finishSignIn(credential);
      if (result.error) {
        error.value = result.error;
        return;
      }
      // So the account page knows this device holds it.
      rememberPasskey(credential.id);

      finishNavigation();
      return;
    }

    const begun = await beginSignUp(email.value, props.next);
    if (begun.error || !begun.options) {
      error.value = begun.error ?? 'Could not start sign up.';
      return;
    }

    const credential = await startRegistration({
      optionsJSON: begun.options,
    });
    const result = await finishSignUp(
      credential,
      props.next,
      deviceName(navigator.userAgent),
    );
    if (result.error) {
      error.value = result.error;
      return;
    }
    rememberPasskey(credential.id);

    if (result.signedIn) {
      finishNavigation();
      return;
    }

    sent.value = true;
  } catch (err) {
    if (wasCancelled(err)) {
      error.value = 'The passkey prompt was cancelled.';
      return;
    }

    console.error('Error completing the passkey ceremony:', err);
    error.value = 'The passkey could not be used. Try again.';
  } finally {
    isPending.value = false;
  }
}
</script>

<template>
  <p v-if="sent" class="text-muted-foreground text-sm">
    Your passkey is registered. We sent a verification link to {{ email }}.
    Opening it confirms the address and signs you in.
  </p>

  <form v-else class="flex flex-col gap-4" @submit.prevent="handleSubmit">
    <div v-if="mode === 'sign-up'" class="flex flex-col gap-2">
      <Label :for="emailId">Email</Label>
      <Input
        :id="emailId"
        v-model="email"
        type="email"
        autocomplete="email webauthn"
        required
        :disabled="isPending"
      />
    </div>
    <p v-else class="text-muted-foreground text-sm">
      Your browser will offer the passkeys it holds for this site.
    </p>

    <p v-if="error" role="alert" class="text-destructive text-sm">
      {{ error }}
    </p>

    <Button type="submit" :disabled="isPending">
      {{
        mode === 'sign-in'
          ? isPending
            ? 'Waiting for your passkey…'
            : 'Sign in with a passkey'
          : isPending
            ? 'Creating your passkey…'
            : 'Create a passkey'
      }}
    </Button>

    <Button
      type="button"
      variant="link"
      size="sm"
      class="h-auto self-start p-0"
      :disabled="isPending"
      @click="switchMode"
    >
      {{
        mode === 'sign-in' ? 'Create an account' : 'I already have an account'
      }}
    </Button>
  </form>
</template>
