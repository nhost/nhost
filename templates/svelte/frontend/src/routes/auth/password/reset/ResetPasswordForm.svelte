<script lang="ts">
  import { useReplacePage } from '#lib/components/replacePage.ts';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import { signOut } from '#lib/nhost/actions.remote.ts';
  import { NETWORK_ERROR } from '#lib/nhost/errors.ts';
  import { goto } from '$app/navigation';
  import { setNewPassword } from '../actions.remote.ts';
  import PasswordChanged from '../PasswordChanged.svelte';
  import PasswordRequirements from '../PasswordRequirements.svelte';
  import { meetsRequirements } from '../requirements.ts';

  const replacePage = useReplacePage();
  const id = $props.id();
  const passwordId = `${id}-password`;
  const confirmId = `${id}-confirm`;
  const rulesId = `${id}-rules`;

  let password = $state('');
  let confirm = $state('');
  let error = $state<string>();
  let isSaving = $state(false);

  const handleSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    error = undefined;

    if (password !== confirm) {
      error = 'The two passwords do not match.';
      return;
    }

    isSaving = true;
    try {
      const result = await setNewPassword(password);
      if (result.error) {
        error = result.error;
        return;
      }

      replacePage(PasswordChanged, {});
    } catch (err) {
      console.error('Error changing the password:', err);
      error = NETWORK_ERROR;
    } finally {
      isSaving = false;
    }
  };

  // The way out without a new password. The server hook keeps a reset link's
  // session on this page until one is saved, so leaving means ending it.
  const handleCancel = async (): Promise<void> => {
    error = undefined;
    isSaving = true;
    try {
      const result = await signOut();
      if (result.error) {
        error = result.error;
        return;
      }

      await goto('/', { refreshAll: true });
    } catch (err) {
      console.error('Error cancelling the reset:', err);
      error = NETWORK_ERROR;
    } finally {
      isSaving = false;
    }
  };
</script>

<form class="flex flex-col gap-4" onsubmit={handleSubmit}>
  <div class="flex flex-col gap-2">
    <Label for={passwordId}>New password</Label>
    <Input
      id={passwordId}
      type="password"
      autocomplete="new-password"
      required
      bind:value={password}
      disabled={isSaving}
      aria-describedby={rulesId}
    />
  </div>

  <div class="flex flex-col gap-2">
    <Label for={confirmId}>Confirm new password</Label>
    <Input
      id={confirmId}
      type="password"
      autocomplete="new-password"
      required
      bind:value={confirm}
      disabled={isSaving}
      aria-describedby={rulesId}
    />
  </div>

  <PasswordRequirements id={rulesId} {password} {confirm} />

  {#if error}
    <p role="alert" class="text-destructive text-sm">{error}</p>
  {/if}

  <Button type="submit" disabled={isSaving || !meetsRequirements(password, confirm)}>
    {isSaving ? 'Saving…' : 'Save password'}
  </Button>

  <Button
    type="button"
    variant="ghost"
    size="sm"
    class="self-center"
    disabled={isSaving}
    onclick={() => void handleCancel()}
  >
    Cancel
  </Button>
</form>
