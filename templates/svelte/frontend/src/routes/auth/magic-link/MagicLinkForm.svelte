<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import { NETWORK_ERROR } from '#lib/nhost/errors.ts';
  import { sendMagicLink } from './actions.remote.ts';

  let { next }: { next: string } = $props();

  const emailId = $props.id();

  let email = $state('');
  let sent = $state(false);
  let error = $state<string>();
  let isSending = $state(false);

  const handleSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    error = undefined;
    isSending = true;
    try {
      const result = await sendMagicLink({ email, next });
      if (result?.error) {
        error = result.error;
        return;
      }

      sent = true;
    } catch (err) {
      console.error('Error sending the magic link:', err);
      error = NETWORK_ERROR;
    } finally {
      isSending = false;
    }
  };

  const useDifferentAddress = (): void => {
    sent = false;
    email = '';
    error = undefined;
  };
</script>

{#if sent}
  <div class="flex flex-col gap-4">
    <p class="text-muted-foreground text-sm">
      A sign-in link is on its way to {email}. Open it in this browser to sign
      in here.
    </p>
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onclick={useDifferentAddress}
      class="self-center"
    >
      Use a different address
    </Button>
  </div>
{:else}
  <form onsubmit={handleSubmit} class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <Label for={emailId}>Email</Label>
      <Input
        id={emailId}
        name="email"
        type="email"
        autocomplete="email"
        placeholder="you@example.com"
        bind:value={email}
        disabled={isSending}
        required
      />
    </div>

    {#if error}
      <p role="alert" class="text-destructive text-sm">{error}</p>
    {/if}

    <Button type="submit" disabled={isSending || !email}>
      {isSending ? 'Sending…' : 'Send me a link'}
    </Button>
  </form>
{/if}
