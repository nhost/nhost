<script setup lang="ts">
import type { User } from '@nhost/nhost-js/auth';
import { computed } from 'vue';
import { listPasskeys } from '@/app/auth/passkey/manage/actions';
import ManagePasskeys from '@/app/auth/passkey/manage/ManagePasskeys.vue';
import { passkeyName } from '@/app/auth/passkey/manage/names';
import DialogSetting from '@/components/DialogSetting.vue';
import { useLoad } from '@/lib/useLoad';

// Every account setting is given the user; this one reads its own list.
defineProps<{ user: User }>();

// Read when the account page renders, not when the dialog opens: the names are
// the row's value, and adding or removing one refreshes the page, which reads
// them again.
const loaded = useLoad(listPasskeys);
const keys = computed(() => loaded.value?.keys ?? []);
const empty = computed(
  () => loaded.value !== undefined && keys.value.length === 0,
);

const value = computed(() => {
  if (!loaded.value) {
    return 'Loading…';
  }
  if (loaded.value.error) {
    return 'Could not load';
  }
  if (empty.value) {
    return 'None';
  }
  return keys.value.map(passkeyName).join(', ');
});
</script>

<template>
  <DialogSetting
    label="Passkeys"
    :value="value"
    :action="empty ? 'Add' : 'Manage'"
    :title="empty ? 'Add a passkey' : 'Passkeys'"
    description="Sign in with your fingerprint, face or device PIN."
  >
    <p v-if="!loaded" class="text-muted-foreground text-sm">Loading…</p>
    <p v-else-if="loaded.error" role="alert" class="text-destructive text-sm">
      {{ loaded.error }}
    </p>
    <ManagePasskeys v-else :keys="keys" />
  </DialogSetting>
</template>
