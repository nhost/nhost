<script setup lang="ts">
import { ref, useId } from 'vue';
import { useRouter } from 'vue-router';
import { setNewPassword } from '@/app/auth/password/actions';
import PasswordChanged from '@/app/auth/password/PasswordChanged.vue';
import PasswordRequirements from '@/app/auth/password/PasswordRequirements.vue';
import { meetsRequirements } from '@/app/auth/password/requirements';
import { useReplacePage } from '@/components/replacePage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signOut } from '@/lib/nhost/actions';
import { NETWORK_ERROR } from '@/lib/nhost/errors';

const router = useRouter();
const replacePage = useReplacePage();
const passwordId = useId();
const confirmId = useId();
const rulesId = useId();

const password = ref('');
const confirm = ref('');
const error = ref<string>();
const isSaving = ref(false);

async function handleSubmit(): Promise<void> {
  error.value = undefined;

  if (password.value !== confirm.value) {
    error.value = 'The two passwords do not match.';
    return;
  }

  isSaving.value = true;
  try {
    const result = await setNewPassword(password.value);
    if (result.error) {
      error.value = result.error;
      return;
    }

    replacePage(PasswordChanged);
  } catch (err) {
    console.error('Error changing the password:', err);
    error.value = NETWORK_ERROR;
  } finally {
    isSaving.value = false;
  }
}

// The way out without a new password. The guard keeps a reset link's session
// on this page until one is saved, so leaving means ending it.
async function handleCancel(): Promise<void> {
  error.value = undefined;
  isSaving.value = true;
  try {
    const result = await signOut();
    if (result.error) {
      error.value = result.error;
      return;
    }

    await router.push('/');
  } catch (err) {
    console.error('Error cancelling the reset:', err);
    error.value = NETWORK_ERROR;
  } finally {
    isSaving.value = false;
  }
}
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
        :disabled="isSaving"
        :aria-describedby="rulesId"
      />
    </div>

    <div class="flex flex-col gap-2">
      <Label :for="confirmId">Confirm new password</Label>
      <Input
        :id="confirmId"
        v-model="confirm"
        type="password"
        autocomplete="new-password"
        required
        :disabled="isSaving"
        :aria-describedby="rulesId"
      />
    </div>

    <PasswordRequirements
      :id="rulesId"
      :password="password"
      :confirm="confirm"
    />

    <p v-if="error" role="alert" class="text-destructive text-sm">
      {{ error }}
    </p>

    <Button
      type="submit"
      :disabled="isSaving || !meetsRequirements(password, confirm)"
    >
      {{ isSaving ? 'Saving…' : 'Save password' }}
    </Button>

    <Button
      type="button"
      variant="ghost"
      size="sm"
      class="self-center"
      :disabled="isSaving"
      @click="handleCancel"
    >
      Cancel
    </Button>
  </form>
</template>
