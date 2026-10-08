<script setup lang="ts">
import { ref, useId } from 'vue';
import { useRouter } from 'vue-router';
import { setNewPassword } from '@/auth/password/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/nhost/auth';

const { nhost } = useAuth();
const router = useRouter();
const passwordId = useId();

const password = ref('');
const error = ref<string | undefined>();
const isPending = ref(false);

const handleSubmit = async (): Promise<void> => {
  error.value = undefined;
  isPending.value = true;
  try {
    const result = await setNewPassword(nhost, password.value);
    if (result.error) {
      error.value = result.error;
      return;
    }

    // The link already signed them in, so there is nowhere to send them but
    // on into the app.
    await router.push('/protected');
  } catch (err) {
    console.error('Error changing the password:', err);
    error.value = 'The request did not reach the server. Try again.';
  } finally {
    isPending.value = false;
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
        :disabled="isPending"
      />
    </div>

    <p v-if="error" role="alert" class="text-destructive text-sm">
      {{ error }}
    </p>

    <Button type="submit" :disabled="isPending || !password">
      {{ isPending ? 'Saving…' : 'Save the new password' }}
    </Button>
  </form>
</template>
