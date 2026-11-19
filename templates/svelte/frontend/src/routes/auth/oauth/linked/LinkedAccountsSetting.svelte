<!--
  @component
  The providers the deployment set up, and which of them this account can sign
  in with.
-->
<script lang="ts" module>
  // Fixed locale and zone, as on the profile: this renders on the server.
  const day = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
</script>

<script lang="ts">
  import type { User } from '@nhost/nhost-js/auth';
  import DialogSetting from '#lib/components/DialogSetting.svelte';
  import { configuredProviders, connectHref } from '../providers.ts';
  import { listLinkedAccounts } from './actions.remote.ts';
  import ManageLinkedAccounts, {
    type LinkedProvider,
  } from './ManageLinkedAccounts.svelte';

  let { user }: { user: User } = $props();

  const { links, error } = $derived(await listLinkedAccounts());
  const all = $derived(links ?? []);

  const providers: LinkedProvider[] = $derived(
    configuredProviders().map(({ id, name }) => {
      const link = all.find(({ providerId }) => providerId === id);
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
  const linked = $derived(providers.filter(({ link }) => link));

  const value = $derived.by(() => {
    if (error) {
      return 'Could not load';
    }
    if (linked.length === 0) {
      return 'None';
    }
    return linked.map(({ name }) => name).join(', ');
  });
</script>

<DialogSetting
  label="Linked accounts"
  {value}
  action={linked.length === 0 ? 'Add' : 'Manage'}
  title="Linked accounts"
  description="Sign in to this account with any of these as well."
>
  {#if error}
    <p role="alert" class="text-destructive text-sm">{error}</p>
  {:else}
    <ManageLinkedAccounts {providers} email={user.email} links={all.length} />
  {/if}
</DialogSetting>
