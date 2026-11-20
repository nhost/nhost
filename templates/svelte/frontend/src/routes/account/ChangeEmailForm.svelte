<!-- @component Changing the address, and chasing the verification of the current one. -->
<script lang="ts">
  import DialogClose from '#lib/components/DialogClose.svelte';
  import DialogFooter from '#lib/components/DialogFooter.svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import { NETWORK_ERROR } from '#lib/nhost/errors.ts';
  import { changeEmail, resendVerification } from './actions.remote.ts';

  let { email, verified }: { email: string | undefined; verified: boolean } =
    $props();

  // What the dialog shows once a link has gone out: the next step is in the
  // inbox.
  type Sent = { kind: 'change'; to: string } | { kind: 'verification' };

  const emailId = $props.id();

  let newEmail = $state('');
  let sent = $state<Sent>();
  let error = $state<string>();
  let isPending = $state(false);

  const handleSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    error = undefined;
    isPending = true;
    try {
      const result = await changeEmail(newEmail);
      if (result.error) {
        error = result.error;
        return;
      }

      sent = { kind: 'change', to: newEmail };
      newEmail = '';
    } catch (err) {
      console.error('Error starting the email change:', err);
      error = NETWORK_ERROR;
    } finally {
      isPending = false;
    }
  };

  const handleResend = async (): Promise<void> => {
    error = undefined;
    isPending = true;
    try {
      const result = await resendVerification();
      if (result.error) {
        error = result.error;
        return;
      }

      sent = { kind: 'verification' };
    } catch (err) {
      console.error('Error resending the verification email:', err);
      error = NETWORK_ERROR;
    } finally {
      isPending = false;
    }
  };
</script>

{#if sent}
  <div class="flex flex-col gap-5">
    <p class="text-muted-foreground text-sm" role="status">
      {sent.kind === 'change'
        ? `We sent a confirmation link to ${sent.to}. The address changes when you open it.`
        : `Another verification link is on its way to ${email}.`}
    </p>
    <DialogFooter>
      <DialogClose>Done</DialogClose>
    </DialogFooter>
  </div>
{:else}
  <form class="flex flex-col gap-5" onsubmit={handleSubmit}>
    {#if email && !verified}
      <div
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
      >
        <p class="text-destructive text-sm">
          This address has not been verified.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onclick={() => void handleResend()}
        >
          Resend verification
        </Button>
      </div>
    {/if}

    <div class="flex flex-col gap-2">
      <Label for={emailId}>New email</Label>
      <Input
        id={emailId}
        type="email"
        autocomplete="email"
        placeholder="you@example.com"
        required
        bind:value={newEmail}
        disabled={isPending}
      />
    </div>

    {#if error}
      <p role="alert" class="text-destructive text-sm">{error}</p>
    {/if}

    <DialogFooter>
      <DialogClose disabled={isPending} />
      <Button
        type="submit"
        size="sm"
        disabled={isPending || !newEmail.includes('@')}
      >
        {isPending ? 'Sending…' : 'Send link'}
      </Button>
    </DialogFooter>
  </form>
{/if}
