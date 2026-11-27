<!--
  @component
  `needsCode` is for an account with two-factor on: signing this browser back
  in with the new password takes a current code from the authenticator app too,
  so the form asks for one alongside it.
-->
<script lang="ts">
  import DialogClose from '#lib/components/DialogClose.svelte';
  import DialogFooter from '#lib/components/DialogFooter.svelte';
  import { useCloseDialog } from '#lib/components/dialog.ts';
  import { useReplacePage } from '#lib/components/replacePage.ts';
  import { useToast } from '#lib/components/toast.svelte.ts';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import { NETWORK_ERROR } from '#lib/nhost/errors.ts';
  import { refreshAll } from '$app/navigation';
  import PasswordChanged from '../PasswordChanged.svelte';
  import PasswordRequirements from '../PasswordRequirements.svelte';
  import { meetsRequirements } from '../requirements.ts';
  import { changePassword } from './actions.remote.ts';

  let { needsCode = false }: { needsCode?: boolean } = $props();

  const replacePage = useReplacePage();
  const toast = useToast();
  const close = useCloseDialog();
  const id = $props.id();
  const passwordId = `${id}-password`;
  const confirmId = `${id}-confirm`;
  const rulesId = `${id}-rules`;
  const codeId = `${id}-code`;

  let password = $state('');
  let confirm = $state('');
  let code = $state('');
  let error = $state<string>();
  let isPending = $state(false);

  const ready = $derived(
    meetsRequirements(password, confirm) &&
      (!needsCode || /^\d{6}$/.test(code.trim())),
  );

  const handleSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    error = undefined;

    if (password !== confirm) {
      error = 'The two passwords do not match.';
      return;
    }

    isPending = true;
    try {
      const result = await changePassword({
        newPassword: password,
        otp: needsCode ? code.trim() : undefined,
      });
      if (result.error) {
        error = result.error;
        return;
      }

      // Signed back in, so the page stays: only the other devices lost their
      // session, and the session list under this is read again.
      if (result.signedIn) {
        close();
        toast('Password changed');
        await refreshAll();
        return;
      }

      replacePage(PasswordChanged, {});
    } catch (err) {
      console.error('Error changing the password:', err);
      error = NETWORK_ERROR;
    } finally {
      isPending = false;
    }
  };
</script>

<!-- What changing it costs is the dialog's description, above this. -->
<form class="flex flex-col gap-5" onsubmit={handleSubmit}>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <Label for={passwordId}>New password</Label>
      <Input
        id={passwordId}
        type="password"
        autocomplete="new-password"
        required
        bind:value={password}
        disabled={isPending}
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
        disabled={isPending}
        aria-describedby={rulesId}
      />
    </div>

    <PasswordRequirements
      id={rulesId}
      {password}
      {confirm}
      class="flex-row flex-wrap items-start gap-x-4 text-xs"
    />

    {#if needsCode}
      <div class="flex flex-col gap-2">
        <Label for={codeId}>Authenticator code</Label>
        <Input
          id={codeId}
          inputmode="numeric"
          autocomplete="one-time-code"
          placeholder="000000"
          required
          bind:value={code}
          disabled={isPending}
          class="font-mono tracking-widest"
        />
      </div>
    {/if}
  </div>

  {#if error}
    <p role="alert" class="text-destructive text-sm">{error}</p>
  {/if}

  <DialogFooter>
    <DialogClose disabled={isPending} />
    <Button type="submit" size="sm" disabled={isPending || !ready}>
      {isPending ? 'Changing…' : 'Change password'}
    </Button>
  </DialogFooter>
</form>
