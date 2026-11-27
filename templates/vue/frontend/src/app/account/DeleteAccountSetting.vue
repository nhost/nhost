<script setup lang="ts">
import { useRouter } from 'vue-router';
import { deleteAccount } from '@/app/account/actions';
import ConfirmAction from '@/app/account/ConfirmAction.vue';
import DialogSetting from '@/components/DialogSetting.vue';
import { NETWORK_ERROR } from '@/lib/nhost/errors';

/** Closing the account for good. */
const router = useRouter();

async function handleDelete(): Promise<string | undefined> {
  try {
    const result = await deleteAccount();
    if (result.error) {
      return result.error;
    }

    // The account and its session are gone, so there is nothing here to come
    // back to.
    await router.push('/');
    return undefined;
  } catch (err) {
    console.error('Error deleting the account:', err);
    return NETWORK_ERROR;
  }
}
</script>

<template>
  <DialogSetting
    label="Account"
    value=""
    action="Delete account"
    destructive
    title="Delete account?"
    description="This removes your account, its sign-in methods and its avatar. It can't be undone."
  >
    <ConfirmAction
      type-to-confirm="delete"
      confirm="Delete account"
      pending="Deleting…"
      cancel="Keep account"
      destructive
      :on-confirm="handleDelete"
    />
  </DialogSetting>
</template>
