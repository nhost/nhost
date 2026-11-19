<script setup lang="ts">
import { nextTick, ref, useId, useTemplateRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NETWORK_ERROR } from '@/lib/nhost/errors';
import { sendCode, verifyCode } from './actions';

type Step = 'email' | 'code';

// Where the code the code step waits for came from. Only the most recent one
// sent works, which matters once there has been more than one.
type Sent = 'now' | 'again' | 'earlier';

const props = defineProps<{ next: string; sentTo?: string }>();

const router = useRouter();
const emailId = useId();
const codeId = useId();
const codeInput = useTemplateRef<{ $el: HTMLInputElement }>('code');

// Given the address a code went to, the form starts where the visitor left it:
// waiting for them to type the code in.
const step = ref<Step>(props.sentTo ? 'code' : 'email');
const sent = ref<Sent>('now');
const email = ref(props.sentTo ?? '');
const otp = ref('');
const error = ref<string>();
const isPending = ref(false);

// Drops the spaces a pasted code brings. The field can still show them when
// the code without them is the one it already had, as Input only redraws on a
// new value, so the pattern allows them and verifyCode drops them too.
watch(otp, (value) => {
  const code = value.replace(/\s/g, '');
  if (code !== value) {
    otp.value = code;
  }
});

watch(
  step,
  async (current) => {
    if (current === 'code') {
      await nextTick();
      codeInput.value?.$el.focus();
    }
  },
  { immediate: true },
);

async function send(): Promise<void> {
  error.value = undefined;
  isPending.value = true;
  try {
    const result = await sendCode(email.value, props.next);
    if (result?.error) {
      error.value = result.error;
      return;
    }

    otp.value = '';
    sent.value = step.value === 'code' ? 'again' : 'now';
    step.value = 'code';
  } catch (err) {
    console.error('Error sending the code:', err);
    error.value = NETWORK_ERROR;
  } finally {
    isPending.value = false;
  }
}

async function handleVerify(): Promise<void> {
  error.value = undefined;
  isPending.value = true;
  try {
    const result = await verifyCode(email.value, otp.value);
    if (result?.error) {
      error.value = result.error;
      return;
    }

    void router.push(props.next);
  } catch (err) {
    console.error('Error verifying the code:', err);
    error.value = NETWORK_ERROR;
  } finally {
    isPending.value = false;
  }
}

// The link in the code email lands on the email step; sending again from
// there would replace the code that email holds.
function haveCode(event: MouseEvent): void {
  const button = event.currentTarget as HTMLButtonElement;
  if (button.form?.reportValidity() === false) {
    return;
  }

  error.value = undefined;
  sent.value = 'earlier';
  step.value = 'code';
}

function backToEmail(): void {
  step.value = 'email';
  otp.value = '';
  error.value = undefined;
}
</script>

<template>
  <form
    v-if="step === 'code'"
    class="flex flex-col gap-4"
    @submit.prevent="handleVerify"
  >
    <p class="text-muted-foreground text-sm">
      <template v-if="sent === 'now'">We sent a code to {{ email }}.</template>
      <template v-else-if="sent === 'again'">
        We sent a new code to {{ email }}. Codes from earlier emails no longer
        work.
      </template>
      <template v-else>
        Enter the code from the most recent email we sent to {{ email }}.
      </template>
    </p>

    <div class="flex flex-col gap-2">
      <Label :for="codeId">Code</Label>
      <Input
        :id="codeId"
        ref="code"
        v-model="otp"
        name="otp"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        pattern="[0-9\s]*"
        :disabled="isPending"
        required
      />
    </div>

    <p v-if="error" role="alert" class="text-destructive text-sm">
      {{ error }}
    </p>

    <Button type="submit" :disabled="isPending || !otp">
      {{ isPending ? 'Signing in…' : 'Sign in' }}
    </Button>

    <div class="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        :disabled="isPending"
        @click="send"
      >
        Send a new code
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        :disabled="isPending"
        @click="backToEmail"
      >
        Use a different address
      </Button>
    </div>
  </form>

  <form v-else class="flex flex-col gap-4" @submit.prevent="send">
    <div class="flex flex-col gap-2">
      <Label :for="emailId">Email</Label>
      <Input
        :id="emailId"
        v-model="email"
        name="email"
        type="email"
        autocomplete="email"
        placeholder="you@example.com"
        :disabled="isPending"
        required
      />
    </div>

    <p v-if="error" role="alert" class="text-destructive text-sm">
      {{ error }}
    </p>

    <Button type="submit" :disabled="isPending || !email">
      {{ isPending ? 'Sending…' : 'Send me a code' }}
    </Button>

    <Button
      type="button"
      variant="ghost"
      size="sm"
      :disabled="isPending || !email"
      @click="haveCode"
    >
      I already have a code
    </Button>
  </form>
</template>
