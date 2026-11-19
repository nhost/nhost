<!-- @component One line per session on the account, each with a way to sign it out. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import Dialog from '#lib/components/Dialog.svelte';
  import { useToast } from '#lib/components/toast.svelte.ts';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { useRemoved } from '#lib/components/useRemoved.svelte.ts';
  import { useSignOut } from '#lib/components/useSignOut.svelte.ts';
  import { NETWORK_ERROR } from '#lib/nhost/errors.ts';
  import { refreshAll } from '$app/navigation';
  import { type AccountSession, signOutSession } from './actions.remote.ts';
  import ConfirmAction from './ConfirmAction.svelte';
  import { formatSessionTime } from './sessions.ts';

  let { sessions: listed }: { sessions: AccountSession[] } = $props();

  const toast = useToast();
  const here = useSignOut();

  // False while the server renders and while Svelte hydrates, true after.
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });

  let error = $state<string>();
  let confirming = $state<string>();

  // Another session leaves the list as soon as it is signed out, rather than
  // once the page has loaded again (see `useRemoved`), and comes back only if
  // the server refused.
  const { removed, remove, restore } = useRemoved();
  const sessions = $derived(
    listed.filter((session) => !removed.has(session.id)),
  );

  // The dialog closes on confirming: this session's line then says it is
  // signing out until the home page arrives, and another's leaves the list.
  const handleConfirm = async (
    session: AccountSession,
  ): Promise<undefined> => {
    confirming = undefined;
    if (session.current) {
      void here.handleSignOut();
    } else {
      void handleSignOut(session);
    }
    return undefined;
  };

  const handleSignOut = async (session: AccountSession): Promise<void> => {
    error = undefined;
    remove(session.id);
    try {
      const result = await signOutSession(session.id);
      if (result.error) {
        restore(session.id);
        error = result.error;
        return;
      }

      toast('Session signed out');
      await refreshAll();
    } catch (err) {
      console.error('Error signing out a session:', err);
      restore(session.id);
      error = NETWORK_ERROR;
    }
  };
</script>

{#each sessions as session (session.id)}
  {@const time = hydrated
    ? formatSessionTime(session.createdAt)
    : `${formatSessionTime(session.createdAt, 'UTC')} UTC`}
  <li class="flex min-h-12 items-center gap-3 px-5 py-2 text-sm">
    <p class="flex min-w-0 flex-1 items-center gap-2">
      <!-- Enough of the id to tell two sessions apart. -->
      <span
        title={session.id}
        class="shrink-0 rounded bg-secondary px-1.5 font-mono text-[11px] text-muted-foreground"
      >
        {session.id.slice(0, 5)}
      </span>
      <span class="min-w-0 truncate text-muted-foreground text-xs">
        Signed in <time datetime={session.createdAt}>{time}</time>
      </span>
      {#if session.current}
        <span
          class="shrink-0 whitespace-nowrap rounded-full border bg-secondary px-2 text-xs"
        >
          This session
        </span>
      {/if}
    </p>
    <Button
      type="button"
      variant="outline"
      size="sm"
      class="shrink-0"
      disabled={here.isSigningOut}
      aria-haspopup="dialog"
      onclick={() => {
        confirming = session.id;
      }}
    >
      {session.current && here.isSigningOut ? 'Signing out…' : 'Sign out'}
    </Button>
    <Dialog
      open={confirming === session.id}
      onOpenChange={(open) => {
        if (!open) {
          confirming = undefined;
        }
      }}
      title={session.current
        ? 'Sign out of this browser?'
        : 'Sign out this session?'}
      description={session.current
        ? "You'll go back to the home page and need to sign in again here."
        : `Session ${session.id.slice(0, 5)} will need to sign in again.`}
    >
      <ConfirmAction
        confirm="Sign out"
        pending="Signing out…"
        destructive
        onConfirm={() => handleConfirm(session)}
      />
    </Dialog>
  </li>
{/each}
{#if error ?? here.error}
  <li role="alert" class="px-5 py-3 text-destructive text-sm">
    {error ?? here.error}
  </li>
{/if}
