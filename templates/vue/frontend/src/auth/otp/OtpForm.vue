<script setup lang="ts">
import { ref, useId } from 'vue';
import { useRouter } from 'vue-router';
import { sendCode, verifyCode } from '@/auth/otp/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/nhost/auth';

const props = defineProps<{ next: string; mailboxUrl: string | null }>();

type Step = 'email' | 'code';

const { nhost } = useAuth();
const router = useRouter();
const emailId = useId();
const codeId = useId();

const step = ref<Step>('email');
const email = ref('');
const otp = ref('');
const error = ref<string | undefined>();
const isPending = ref(false);

const send = async (): Promise<void> => {
  error.value = undefined;
  isPending.value = true;
  try {
    const result = await sendCode(nhost, email.value);
    if (result?.error) {
      error.value = result.error;
      return;
    }

    otp.value = '';
    step.value = 'code';
  } catch (err) {
    console.error('Error sending the code:', err);
    error.value = 'The request did not reach the server. Try again.';
  } finally {
    isPending.value = false;
  }
};

const handleVerify = async (): Promise<void> => {
  error.value = undefined;
  isPending.value = true;
  try {
    const result = await verifyCode(nhost, email.value, otp.value);
    if (result?.error) {
      error.value = result.error;
      return;
    }

    await router.push(props.next);
  } catch (err) {
    console.error('Error verifying the code:', err);
    error.value = 'The request did not reach the server. Try again.';
  } finally {
    isPending.value = false;
  }
};

const backToEmail = (): void => {
  step.value = 'email';
  otp.value = '';
  error.value = undefined;
};
</script>

<template>
  <form
    v-if="step === 'code'"
    class="flex flex-col gap-4"
    @submit.prevent="handleVerify"
  >
    <p class="text-muted-foreground text-sm">
      We sent a code to {{ email }}.
      <template v-if="mailboxUrl">
        Locally it lands in the
        <a
          :href="mailboxUrl"
          target="_blank"
          rel="noreferrer"
          class="underline underline-offset-4"
        >mailbox</a>.
      </template>
    </p>

    <div class="flex flex-col gap-2">
      <Label :for="codeId">Code</Label>
      <Input
        :id="codeId"
        v-model="otp"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        pattern="[0-9]*"
        required
        :disabled="isPending"
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
        type="email"
        autocomplete="email"
        placeholder="you@example.com"
        required
        :disabled="isPending"
      />
    </div>

    <p v-if="error" role="alert" class="text-destructive text-sm">
      {{ error }}
    </p>

    <Button type="submit" :disabled="isPending || !email">
      {{ isPending ? 'Sending…' : 'Send me a code' }}
    </Button>
  </form>
</template>
