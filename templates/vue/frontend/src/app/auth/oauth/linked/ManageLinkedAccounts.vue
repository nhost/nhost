<script setup lang="ts">
import { computed, ref } from 'vue';
import { unlinkProvider } from '@/app/auth/oauth/linked/actions';
import { leavesAWayIn } from '@/app/auth/oauth/linked/wayIn';
import ProviderIcon from '@/app/auth/oauth/ProviderIcon.vue';
import DialogClose from '@/components/DialogClose.vue';
import DialogFooter from '@/components/DialogFooter.vue';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { useRefresh } from '@/components/useRefresh';
import { useRemoved } from '@/components/useRemoved';
import { NETWORK_ERROR } from '@/lib/nhost/errors';

export type LinkedProvider = {
  id: string;
  name: string;
  connectHref: string;
  link?: { id: string; since: string };
};

/**
 * A line per provider: Link account leaves for the provider and comes back to
 * the account page, Unlink stays here with the list read again under it.
 */
const props = defineProps<{
  providers: LinkedProvider[];
  email: string | undefined;
  links: number;
}>();

const refresh = useRefresh();
const toast = useToast();
const error = ref<string>();

// Shown as not linked as soon as Unlink is pressed, rather than once the
// refreshed page arrives (see `useRemoved`).
const { removed, remove, restore } = useRemoved();
const providers = computed(() =>
  props.providers.map((provider) =>
    provider.link && removed.value.has(provider.link.id)
      ? { ...provider, link: undefined }
      : provider,
  ),
);
// Only the removals the list still shows: once it is read again, `links`
// already leaves them out.
const canUnlink = computed(() => {
  const pending = props.providers.filter(
    ({ link }) => link && removed.value.has(link.id),
  ).length;
  return leavesAWayIn(props.email, props.links - pending);
});

async function handleUnlink(provider: LinkedProvider): Promise<void> {
  if (!provider.link) {
    return;
  }

  const { id } = provider.link;
  error.value = undefined;
  remove(id);
  try {
    const result = await unlinkProvider(id);
    if (result.error) {
      restore(id);
      error.value = result.error;
      return;
    }

    toast(`${provider.name} unlinked`);
    refresh();
  } catch (err) {
    console.error('Error unlinking a provider:', err);
    restore(id);
    error.value = NETWORK_ERROR;
  }
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <ul class="divide-y rounded-lg border">
      <li
        v-for="provider in providers"
        :key="provider.id"
        class="flex items-center gap-3 py-2 pr-2 pl-3 text-sm"
      >
        <span class="size-4 shrink-0 [&>svg]:size-4">
          <ProviderIcon :id="provider.id" />
        </span>
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="font-medium">{{ provider.name }}</span>
          <span class="truncate text-muted-foreground text-xs">
            {{ provider.link ? `Linked ${provider.link.since}` : 'Not linked' }}
          </span>
        </span>
        <Button
          v-if="provider.link"
          type="button"
          variant="ghost"
          size="sm"
          class="text-destructive hover:text-destructive"
          :disabled="!canUnlink"
          @click="handleUnlink(provider)"
        >
          Unlink
        </Button>
        <!-- A plain anchor, as on the sign-in list: the page it opens leaves
             for the provider, on another origin. -->
        <Button v-else as-child variant="outline" size="sm">
          <a :href="provider.connectHref">Link account</a>
        </Button>
      </li>
    </ul>

    <p v-if="email" class="text-muted-foreground text-xs">
      Unlinking doesn't block a provider whose verified email is {{ email }}.
      Signing in with it links it again.
    </p>

    <p v-if="!canUnlink" class="text-muted-foreground text-xs">
      This account has no email address, so its only linked account stays until
      another is added.
    </p>

    <p v-if="error" role="alert" class="text-destructive text-sm">
      {{ error }}
    </p>

    <DialogFooter>
      <DialogClose>Done</DialogClose>
    </DialogFooter>
  </div>
</template>
