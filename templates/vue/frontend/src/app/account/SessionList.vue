<script setup lang="ts">
import { computed, ref } from 'vue';
import { type AccountSession, signOutSession } from '@/app/account/actions';
import ConfirmAction from '@/app/account/ConfirmAction.vue';
import { formatSessionTime } from '@/app/account/sessions';
import Dialog from '@/components/Dialog.vue';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { useRefresh } from '@/components/useRefresh';
import { useRemoved } from '@/components/useRemoved';
import { useSignOut } from '@/components/useSignOut';
import { NETWORK_ERROR } from '@/lib/nhost/errors';

/** One line per session on the account, each with a way to sign it out. */
const props = defineProps<{ sessions: AccountSession[] }>();

const refresh = useRefresh();
const toast = useToast();
const error = ref<string>();
const confirming = ref<string>();
const here = useSignOut();
const hereSigningOut = here.isSigningOut;

// Another session leaves the list as soon as it is signed out, rather than
// once the list loads again (see `useRemoved`), and comes back only if the
// backend refused.
const { removed, remove, restore } = useRemoved();
const sessions = computed(() =>
  props.sessions.filter((session) => !removed.value.has(session.id)),
);
const shownError = computed(() => error.value ?? here.error.value);

// The dialog closes on confirming: this session's line then says it is
// signing out until the home page arrives, and another's leaves the list.
async function handleConfirm(session: AccountSession): Promise<undefined> {
  confirming.value = undefined;
  if (session.current) {
    void here.handleSignOut();
  } else {
    void handleSignOut(session);
  }
  return undefined;
}

async function handleSignOut(session: AccountSession): Promise<void> {
  error.value = undefined;
  remove(session.id);
  try {
    const result = await signOutSession(session.id);
    if (result.error) {
      restore(session.id);
      error.value = result.error;
      return;
    }

    toast('Session signed out');
    refresh();
  } catch (err) {
    console.error('Error signing out a session:', err);
    restore(session.id);
    error.value = NETWORK_ERROR;
  }
}

function onOpenChange(open: boolean): void {
  if (!open) {
    confirming.value = undefined;
  }
}
</script>

<template>
  <li
    v-for="session in sessions"
    :key="session.id"
    class="flex min-h-12 items-center gap-3 px-5 py-2 text-sm"
  >
    <p class="flex min-w-0 flex-1 items-center gap-2">
      <!-- Enough of the id to tell two sessions apart. -->
      <span
        :title="session.id"
        class="shrink-0 rounded bg-secondary px-1.5 font-mono text-[11px] text-muted-foreground"
        >{{
          session.id.slice(0, 5)
        }}</span
      >
      <span class="min-w-0 truncate text-muted-foreground text-xs"
        >Signed in
        <time :datetime="session.createdAt">{{
          formatSessionTime(session.createdAt)
        }}</time></span
      >
      <span
        v-if="session.current"
        class="shrink-0 whitespace-nowrap rounded-full border bg-secondary px-2 text-xs"
        >This session</span
      >
    </p>
    <Button
      type="button"
      variant="outline"
      size="sm"
      class="shrink-0"
      :disabled="hereSigningOut"
      aria-haspopup="dialog"
      @click="confirming = session.id"
    >
      {{ session.current && hereSigningOut ? 'Signing out…' : 'Sign out' }}
    </Button>
    <Dialog
      :open="confirming === session.id"
      :title="
        session.current ? 'Sign out of this browser?' : 'Sign out this session?'
      "
      :description="
        session.current
          ? 'You\'ll go back to the home page and need to sign in again here.'
          : `Session ${session.id.slice(0, 5)} will need to sign in again.`
      "
      @update:open="onOpenChange"
    >
      <ConfirmAction
        confirm="Sign out"
        pending="Signing out…"
        destructive
        :on-confirm="() => handleConfirm(session)"
      />
    </Dialog>
  </li>
  <li v-if="shownError" role="alert" class="px-5 py-3 text-destructive text-sm">
    {{ shownError }}
  </li>
</template>
