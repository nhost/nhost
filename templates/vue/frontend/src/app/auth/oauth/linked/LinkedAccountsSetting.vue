<script setup lang="ts">
import type { User } from '@nhost/nhost-js/auth';
import { computed } from 'vue';
import { listLinkedAccounts } from '@/app/auth/oauth/linked/actions';
import ManageLinkedAccounts, {
  type LinkedProvider,
} from '@/app/auth/oauth/linked/ManageLinkedAccounts.vue';
import { configuredProviders, connectHref } from '@/app/auth/oauth/providers';
import DialogSetting from '@/components/DialogSetting.vue';
import { useLoad } from '@/lib/useLoad';

/**
 * The providers the deployment set up, and which of them this account can sign
 * in with.
 */
defineProps<{ user: User }>();

// Fixed locale and zone, as on the profile.
const day = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

const loaded = useLoad(listLinkedAccounts);
const all = computed(() => loaded.value?.links ?? []);

const providers = computed<LinkedProvider[]>(() =>
  configuredProviders().map(({ id, name }) => {
    const link = all.value.find(({ providerId }) => providerId === id);
    return {
      id,
      name,
      connectHref: connectHref(id),
      link: link
        ? { id: link.id, since: day.format(new Date(link.createdAt)) }
        : undefined,
    };
  }),
);
const linked = computed(() => providers.value.filter(({ link }) => link));

const value = computed(() => {
  if (!loaded.value) {
    return 'Loading…';
  }
  if (loaded.value.error) {
    return 'Could not load';
  }
  if (linked.value.length === 0) {
    return 'None';
  }
  return linked.value.map(({ name }) => name).join(', ');
});
</script>

<template>
  <DialogSetting
    label="Linked accounts"
    :value="value"
    :action="loaded && linked.length === 0 ? 'Add' : 'Manage'"
    title="Linked accounts"
    description="Sign in to this account with any of these as well."
  >
    <p v-if="!loaded" class="text-muted-foreground text-sm">Loading…</p>
    <p v-else-if="loaded.error" role="alert" class="text-destructive text-sm">
      {{ loaded.error }}
    </p>
    <ManageLinkedAccounts
      v-else
      :providers="providers"
      :email="user.email"
      :links="all.length"
    />
  </DialogSetting>
</template>
