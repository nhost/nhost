<script setup lang="ts">
import { ref, useId } from 'vue';
import { sendMagicLink } from '@/auth/magic-link/actions';
import CheckYourInbox from '@/components/CheckYourInbox.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/nhost/auth';

const props = defineProps<{ next: string; mailboxUrl: string | null }>();

const { nhost } = useAuth();
const emailId = useId();

const email = ref('');
const sent = ref(false);
const error = ref<string | undefined>();
const isSending = ref(false);

const handleSubmit = async (): Promise<void> => {
  error.value = undefined;
  isSending.value = true;
  try {
    const result = await sendMagicLink(nhost, email.value, props.next);
    if (result?.error) {
      error.value = result.error;
      return;
    }

    sent.value = true;
  } catch (err) {
    console.error('Error sending the magic link:', err);
    error.value = 'The request did not reach the server. Try again.';
  } finally {
    isSending.value = false;
  }
};

const useDifferentAddress = (): void => {
  sent.value = false;
  email.value = '';
  error.value = undefined;
};
</script>

<template>
  <div v-if="sent" class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <CheckYourInbox :url="mailboxUrl" />
      <p class="text-muted-foreground text-sm">
        A sign-in link is on its way to {{ email }}. Opening it signs you in on
        this device.
      </p>
    </div>
    <Button
      type="button"
      variant="ghost"
      size="sm"
      class="self-start"
      @click="useDifferentAddress"
    >
      Use a different address
    </Button>
  </div>

  <form v-else class="flex flex-col gap-4" @submit.prevent="handleSubmit">
    <div class="flex flex-col gap-2">
      <Label :for="emailId">Email</Label>
      <Input
        :id="emailId"
        v-model="email"
        type="email"
        autocomplete="email"
        placeholder="you@example.com"
        required
        :disabled="isSending"
      />
    </div>

    <p v-if="error" role="alert" class="text-destructive text-sm">
      {{ error }}
    </p>

    <Button type="submit" :disabled="isSending || !email">
      {{ isSending ? 'Sending…' : 'Send me a link' }}
    </Button>
  </form>
</template>
