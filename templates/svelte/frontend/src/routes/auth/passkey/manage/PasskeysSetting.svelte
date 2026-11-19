<!--
  Read when the account page renders, not when the dialog opens: the names are
  the row's value, and adding or removing one loads the page again, which reads
  them again.
-->
<script lang="ts">
  import type { User } from '@nhost/nhost-js/auth';
  import DialogSetting from '#lib/components/DialogSetting.svelte';
  import { listPasskeys } from './actions.remote.ts';
  import ManagePasskeys from './ManagePasskeys.svelte';
  import { passkeyName } from './names.ts';

  // Every account row is given the user. This one reads its passkeys instead.
  let { user: _user }: { user: User } = $props();

  const { keys, error } = $derived(await listPasskeys());
  const count = $derived(keys?.length ?? 0);

  const value = $derived.by(() => {
    if (error) {
      return 'Could not load';
    }
    if (count === 0) {
      return 'None';
    }
    return (keys ?? []).map(passkeyName).join(', ');
  });
</script>

<DialogSetting
  label="Passkeys"
  {value}
  action={count === 0 ? 'Add' : 'Manage'}
  title={count === 0 ? 'Add a passkey' : 'Passkeys'}
  description="Sign in with your fingerprint, face or device PIN."
>
  {#if error}
    <p role="alert" class="text-destructive text-sm">{error}</p>
  {:else}
    <ManagePasskeys keys={keys ?? []} />
  {/if}
</DialogSetting>
