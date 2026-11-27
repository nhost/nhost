<!--
  @component
  A line per provider: Link account leaves for the provider and comes back to
  the account page, Unlink stays here with the list read again under it.
-->
<script lang="ts" module>
  export type LinkedProvider = {
    id: string;
    name: string;
    connectHref: string;
    link?: { id: string; since: string };
  };
</script>

<script lang="ts">
  import DialogClose from '#lib/components/DialogClose.svelte';
  import DialogFooter from '#lib/components/DialogFooter.svelte';
  import { useToast } from '#lib/components/toast.svelte.ts';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { useRemoved } from '#lib/components/useRemoved.svelte.ts';
  import { NETWORK_ERROR } from '#lib/nhost/errors.ts';
  import { refreshAll } from '$app/navigation';
  import ProviderIcon from '../ProviderIcon.svelte';
  import { unlinkProvider } from './actions.remote.ts';
  import { leavesAWayIn } from './wayIn.ts';

  let {
    providers: listed,
    email,
    links,
  }: {
    providers: LinkedProvider[];
    email: string | undefined;
    links: number;
  } = $props();

  const toast = useToast();
  let error = $state<string>();

  // Shown as not linked as soon as Unlink is pressed, rather than once the page
  // has loaded again (see `useRemoved`).
  const { removed, remove, restore } = useRemoved();
  const providers = $derived(
    listed.map((provider) =>
      provider.link && removed.has(provider.link.id)
        ? { ...provider, link: undefined }
        : provider,
    ),
  );
  // Only the removals the list still shows: once it is read again, `links`
  // already leaves them out.
  const pending = $derived(
    listed.filter(({ link }) => link && removed.has(link.id)).length,
  );
  const canUnlink = $derived(leavesAWayIn(email, links - pending));

  const handleUnlink = async (provider: LinkedProvider): Promise<void> => {
    if (!provider.link) {
      return;
    }

    const { id } = provider.link;
    error = undefined;
    remove(id);
    try {
      const result = await unlinkProvider(id);
      if (result.error) {
        restore(id);
        error = result.error;
        return;
      }

      toast(`${provider.name} unlinked`);
      await refreshAll();
    } catch (err) {
      console.error('Error unlinking a provider:', err);
      restore(id);
      error = NETWORK_ERROR;
    }
  };
</script>

<div class="flex flex-col gap-5">
  <ul class="divide-y rounded-lg border">
    {#each providers as provider (provider.id)}
      <li class="flex items-center gap-3 py-2 pr-2 pl-3 text-sm">
        <span class="size-4 shrink-0 [&>svg]:size-4">
          <ProviderIcon id={provider.id} />
        </span>
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="font-medium">{provider.name}</span>
          <span class="truncate text-muted-foreground text-xs">
            {provider.link ? `Linked ${provider.link.since}` : 'Not linked'}
          </span>
        </span>
        {#if provider.link}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="text-destructive hover:text-destructive"
            disabled={!canUnlink}
            onclick={() => void handleUnlink(provider)}
          >
            Unlink
          </Button>
        {:else}
          <!-- A full page load, as on the sign-in list: the route it opens
               leaves for the provider, on another origin. -->
          <Button
            href={provider.connectHref}
            data-sveltekit-reload
            variant="outline"
            size="sm"
          >
            Link account
          </Button>
        {/if}
      </li>
    {/each}
  </ul>

  {#if email}
    <p class="text-muted-foreground text-xs">
      Unlinking doesn't block a provider whose verified email is {email}.
      Signing in with it links it again.
    </p>
  {/if}

  {#if !canUnlink}
    <p class="text-muted-foreground text-xs">
      This account has no email address, so its only linked account stays until
      another is added.
    </p>
  {/if}

  {#if error}
    <p role="alert" class="text-destructive text-sm">{error}</p>
  {/if}

  <DialogFooter>
    <DialogClose>Done</DialogClose>
  </DialogFooter>
</div>
