<!-- @component Closing the account for good. -->
<script lang="ts">
  import DialogSetting from '#lib/components/DialogSetting.svelte';
  import { NETWORK_ERROR } from '#lib/nhost/errors.ts';
  import { goto } from '$app/navigation';
  import { deleteAccount } from './actions.remote.ts';
  import ConfirmAction from './ConfirmAction.svelte';

  const handleDelete = async (): Promise<string | undefined> => {
    try {
      const result = await deleteAccount();
      if (result.error) {
        return result.error;
      }

      // The account and its session are gone, so there is nothing here to
      // come back to.
      await goto('/', { refreshAll: true });
      return undefined;
    } catch (err) {
      console.error('Error deleting the account:', err);
      return NETWORK_ERROR;
    }
  };
</script>

<DialogSetting
  label="Account"
  value=""
  action="Delete account"
  destructive
  title="Delete account?"
  description="This removes your account, its sign-in methods and its avatar. It can't be undone."
>
  <ConfirmAction
    typeToConfirm="delete"
    confirm="Delete account"
    pending="Deleting…"
    cancel="Keep account"
    destructive
    onConfirm={handleDelete}
  />
</DialogSetting>
