<script setup lang="ts">
import { ref, useId } from 'vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NETWORK_ERROR } from '@/lib/nhost/errors';
import { sendMagicLink } from './actions';

const props = defineProps<{ next: string }>();

const emailId = useId();

const email = ref('');
const sent = ref(false);
const error = ref<string>();
const isSending = ref(false);

async function handleSubmit(): Promise<void> {
  error.value = undefined;
  isSending.value = true;
  try {
    const result = await sendMagicLink(email.value, props.next);
    if (result?.error) {
      error.value = result.error;
      return;
    }

    sent.value = true;
  } catch (err) {
    console.error('Error sending the magic link:', err);
    error.value = NETWORK_ERROR;
  } finally {
    isSending.value = false;
  }
}

function changeAddress(): void {
  sent.value = false;
  email.value = '';
  error.value = undefined;
}
</script>

<template>
  <div v-if="sent" class="flex flex-col gap-4">
    <p class="text-muted-foreground text-sm">
      A sign-in link is on its way to {{ email }}. Open it in this browser to
      sign in here.
    </p>
    <Button
      type="button"
      variant="ghost"
      size="sm"
      class="self-center"
      @click="changeAddress"
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
        name="email"
        type="email"
        autocomplete="email"
        placeholder="you@example.com"
        :disabled="isSending"
        required
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
