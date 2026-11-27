<script setup lang="ts">
import { nextTick, ref, useId, useTemplateRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  requestPasswordReset,
  signIn,
  signUp,
  verifyMfa,
} from '@/app/auth/password/actions';
import PasswordRequirements from '@/app/auth/password/PasswordRequirements.vue';
import { meetsRequirements } from '@/app/auth/password/requirements';
import type { Intent } from '@/app/signin/intent';
import { signInQuery } from '@/app/signin/query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NETWORK_ERROR } from '@/lib/nhost/errors';

type Mode = 'sign-in' | 'sign-up';

// What the form shows once a request has gone out and there is nothing more
// to type: the next step happens in the visitor's inbox.
type Sent = 'verification' | 'reset';

const props = defineProps<{ next: string; intent: Intent }>();

const router = useRouter();
const route = useRoute();
const emailId = useId();
const passwordId = useId();
const codeId = useId();
const rulesId = useId();
const codeInput = useTemplateRef<{ $el: HTMLInputElement }>('codeInput');

// Opens on whatever the link that sent them here asked for, which is sign-up
// unless it said otherwise: a fresh local backend has no accounts in it, so a
// sign-in form would be a dead end.
const mode = ref<Mode>(props.intent);
const email = ref('');
const password = ref('');
const sent = ref<Sent>();
// Set when the password was right but the account has two-factor on: the
// backend wants a code from the authenticator app before it issues a session.
const mfaTicket = ref<string>();
// Auth spends the ticket on every attempt, right or wrong, so a retry signs in
// again with the same password for a fresh one.
const ticketSpent = ref(false);
const code = ref('');
const error = ref<string>();
const isPending = ref(false);

watch(mfaTicket, async (ticket, before) => {
  if (ticket && !before) {
    await nextTick();
    codeInput.value?.$el.focus();
  }
});

function finishSignIn(): void {
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
  isPending.value = true;
  try {
    if (mode.value === 'sign-in') {
      const result = await signIn(email.value, password.value);
      if (result.error) {
        error.value = result.error;
        return;
      }

      if (result.mfaTicket) {
        mfaTicket.value = result.mfaTicket;
        return;
      }

      finishSignIn();
      return;
    }

    const result = await signUp(email.value, password.value, props.next);
    if (result.error) {
      error.value = result.error;
      return;
    }

    if (result.signedIn) {
      finishSignIn();
      return;
    }

    sent.value = 'verification';
  } catch (err) {
    console.error('Error submitting the form:', err);
    error.value = NETWORK_ERROR;
  } finally {
    isPending.value = false;
  }
}

async function handleVerifyCode(): Promise<void> {
  error.value = undefined;
  isPending.value = true;
  try {
    let ticket = mfaTicket.value;
    if (ticketSpent.value) {
      const fresh = await signIn(email.value, password.value);
      if (fresh.error) {
        error.value = fresh.error;
        return;
      }

      // Two-factor was turned off in the meantime: the password alone was
      // enough.
      if (!fresh.mfaTicket) {
        finishSignIn();
        return;
      }

      ticket = fresh.mfaTicket;
      mfaTicket.value = ticket;
      ticketSpent.value = false;
    }

    const result = await verifyMfa(ticket ?? '', code.value);
    if (result.error) {
      ticketSpent.value = true;
      error.value = result.error;
      return;
    }

    finishSignIn();
  } catch (err) {
    console.error('Error verifying the code:', err);
    ticketSpent.value = true;
    error.value = NETWORK_ERROR;
  } finally {
    isPending.value = false;
  }
}

// Keeps the email: going back is usually for the same account, with the ticket
// lapsed or the authenticator not to hand.
function startOver(): void {
  mfaTicket.value = undefined;
  ticketSpent.value = false;
  code.value = '';
  password.value = '';
  error.value = undefined;
}

async function handleForgotPassword(): Promise<void> {
  error.value = undefined;
  isPending.value = true;
  try {
    const result = await requestPasswordReset(email.value);
    if (result.error) {
      error.value = result.error;
      return;
    }

    sent.value = 'reset';
  } catch (err) {
    console.error('Error requesting the reset link:', err);
    error.value = NETWORK_ERROR;
  } finally {
    isPending.value = false;
  }
}
</script>

<template>
  <p v-if="sent === 'verification'" class="text-muted-foreground text-sm">
    We sent a verification link to {{ email }}. Opening it confirms the address
    and signs you in.
  </p>

  <p v-else-if="sent === 'reset'" class="text-muted-foreground text-sm">
    If that address has an account, a reset link is on its way.
  </p>

  <form
    v-else-if="mfaTicket"
    class="flex flex-col gap-4"
    @submit.prevent="handleVerifyCode"
  >
    <div class="flex flex-col gap-2">
      <Label :for="codeId">Authenticator code</Label>
      <Input
        :id="codeId"
        ref="codeInput"
        v-model="code"
        inputmode="numeric"
        autocomplete="one-time-code"
        required
        :disabled="isPending"
      />
    </div>

    <p v-if="error" role="alert" class="text-destructive text-sm">
      {{ error }}
    </p>

    <Button type="submit" :disabled="isPending">
      {{ isPending ? 'Verifying…' : 'Verify' }}
    </Button>

    <Button
      type="button"
      variant="ghost"
      size="sm"
      class="self-start"
      :disabled="isPending"
      @click="startOver"
    >
      Start over
    </Button>
  </form>

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
        :autocomplete="mode === 'sign-in' ? 'current-password' : 'new-password'"
        required
        :disabled="isPending"
        :aria-describedby="mode === 'sign-up' ? rulesId : undefined"
      />
      <!-- Only while signing up. Signing in, the password already exists, and
           whether it would pass today's rules is not the question. -->
      <PasswordRequirements
        v-if="mode === 'sign-up'"
        :id="rulesId"
        :password="password"
      />
    </div>

    <p v-if="error" role="alert" class="text-destructive text-sm">
      {{ error }}
    </p>

    <Button
      type="submit"
      :disabled="
        isPending || (mode === 'sign-up' && !meetsRequirements(password))
      "
    >
      {{
        mode === 'sign-in'
          ? isPending
            ? 'Signing in…'
            : 'Sign in'
          : isPending
            ? 'Signing up…'
            : 'Sign up'
      }}
    </Button>

    <!-- Centred, not spread: signing up there is only one link here, and
         justify-between left it hard against the left edge of a card whose
         heading and button are both centred. -->
    <div class="flex flex-wrap items-center justify-center gap-4 text-sm">
      <Button
        type="button"
        variant="link"
        size="sm"
        class="h-auto p-0"
        :disabled="isPending"
        @click="switchMode"
      >
        {{
          mode === 'sign-in' ? 'Create an account' : 'I already have an account'
        }}
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
