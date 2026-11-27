<script setup lang="ts">
import { ref, useId } from 'vue';
import { changeEmail, resendVerification } from '@/app/account/actions';
import DialogClose from '@/components/DialogClose.vue';
import DialogFooter from '@/components/DialogFooter.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NETWORK_ERROR } from '@/lib/nhost/errors';

// What the dialog shows once a link has gone out: the next step is in the
// inbox.
type Sent = { kind: 'change'; to: string } | { kind: 'verification' };

/** Changing the address, and chasing the verification of the current one. */
defineProps<{ email: string | undefined; verified: boolean }>();

const emailId = useId();

const newEmail = ref('');
const sent = ref<Sent>();
const error = ref<string>();
const isPending = ref(false);

async function handleSubmit(): Promise<void> {
  error.value = undefined;
  isPending.value = true;
  try {
    const result = await changeEmail(newEmail.value);
    if (result.error) {
      error.value = result.error;
      return;
    }

    sent.value = { kind: 'change', to: newEmail.value };
    newEmail.value = '';
  } catch (err) {
    console.error('Error starting the email change:', err);
    error.value = NETWORK_ERROR;
  } finally {
    isPending.value = false;
  }
}

async function handleResend(): Promise<void> {
  error.value = undefined;
  isPending.value = true;
  try {
    const result = await resendVerification();
    if (result.error) {
      error.value = result.error;
      return;
    }

    sent.value = { kind: 'verification' };
  } catch (err) {
    console.error('Error resending the verification email:', err);
    error.value = NETWORK_ERROR;
  } finally {
    isPending.value = false;
  }
}
</script>

<template>
  <div v-if="sent" class="flex flex-col gap-5">
    <p class="text-muted-foreground text-sm" role="status">
      {{
        sent.kind === 'change'
          ? `We sent a confirmation link to ${sent.to}. The address changes when you open it.`
          : `Another verification link is on its way to ${email}.`
      }}
    </p>
    <DialogFooter>
      <DialogClose>Done</DialogClose>
    </DialogFooter>
  </div>

  <form v-else class="flex flex-col gap-5" @submit.prevent="handleSubmit">
    <div
      v-if="email && !verified"
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
    >
      <p class="text-destructive text-sm">
        This address has not been verified.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        :disabled="isPending"
        @click="handleResend"
      >
        Resend verification
      </Button>
    </div>

    <div class="flex flex-col gap-2">
      <Label :for="emailId">New email</Label>
      <Input
        :id="emailId"
        v-model="newEmail"
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

    <DialogFooter>
      <DialogClose :disabled="isPending" />
      <Button
        type="submit"
        size="sm"
        :disabled="isPending || !newEmail.includes('@')"
      >
        {{ isPending ? 'Sending…' : 'Send link' }}
      </Button>
    </DialogFooter>
  </form>
</template>
