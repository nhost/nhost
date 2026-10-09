<script setup lang="ts">
import { ref, useId } from 'vue';
import { setNewPassword } from '@/auth/password/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/nhost/auth';

const pending = defineModel<boolean>('pending', { default: false });
const emit = defineEmits<{ changed: [] }>();

const { nhost } = useAuth();
const passwordId = useId();

const password = ref('');
const error = ref<string | undefined>();

const handleSubmit = async (): Promise<void> => {
  error.value = undefined;
  pending.value = true;
  try {
    const result = await setNewPassword(nhost, password.value);
    if (result.error) {
      error.value = result.error;
      return;
    }

    emit('changed');
  } catch (err) {
    console.error('Error changing the password:', err);
    error.value = 'The request did not reach the server. Try again.';
  } finally {
    pending.value = false;
  }
};
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
    <div class="flex flex-col gap-2">
      <Label :for="passwordId">New password</Label>
      <Input
        :id="passwordId"
        v-model="password"
        type="password"
        autocomplete="new-password"
        required
        :disabled="pending"
      />
    </div>

    <p v-if="error" role="alert" class="text-destructive text-sm">
      {{ error }}
    </p>

    <Button type="submit" :disabled="pending || !password">
      {{ pending ? 'Saving…' : 'Save the new password' }}
    </Button>
  </form>
</template>
