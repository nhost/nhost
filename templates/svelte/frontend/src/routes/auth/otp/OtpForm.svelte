<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import { Input } from '#lib/components/ui/input/index.ts';
  import { Label } from '#lib/components/ui/label/index.ts';
  import { NETWORK_ERROR } from '#lib/nhost/errors.ts';
  import { afterSignIn } from '#routes/signin/afterSignIn.ts';
  import { sendCode, verifyCode } from './actions.remote.ts';

  type Step = 'email' | 'code';

  // Where the code the code step waits for came from. Only the most recent one
  // sent works, which matters once there has been more than one.
  type Sent = 'now' | 'again' | 'earlier';

  let { next, sentTo }: { next: string; sentTo?: string } = $props();

  const id = $props.id();
  const emailId = `${id}-email`;
  const codeId = `${id}-code`;

  // Given the address a code went to, the form starts where the visitor left
  // it: waiting for them to type the code in.
  // svelte-ignore state_referenced_locally
  let step = $state<Step>(sentTo ? 'code' : 'email');
  let sent = $state<Sent>('now');
  // svelte-ignore state_referenced_locally
  let email = $state(sentTo ?? '');
  let otp = $state('');
  let codeInput = $state<HTMLInputElement | null>(null);
  let error = $state<string>();
  let isPending = $state(false);

  // The code is all there is to type once the step appears.
  $effect(() => {
    codeInput?.focus();
  });

  const send = async (): Promise<void> => {
    error = undefined;
    isPending = true;
    try {
      const result = await sendCode({ email, next });
      if (result?.error) {
        error = result.error;
        return;
      }

      otp = '';
      sent = step === 'code' ? 'again' : 'now';
      step = 'code';
    } catch (err) {
      console.error('Error sending the code:', err);
      error = NETWORK_ERROR;
    } finally {
      isPending = false;
    }
  };

  const handleSend = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    await send();
  };

  const handleVerify = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    error = undefined;
    isPending = true;
    try {
      const result = await verifyCode({ email, otp });
      if (result?.error) {
        error = result.error;
        return;
      }

      await afterSignIn(next);
    } catch (err) {
      console.error('Error verifying the code:', err);
      error = NETWORK_ERROR;
    } finally {
      isPending = false;
    }
  };

  // The link in the code email lands on the email step; sending again from
  // there would replace the code that email holds.
  const haveCode = (event: MouseEvent): void => {
    const form = (event.currentTarget as HTMLButtonElement).form;
    if (form?.reportValidity() === false) {
      return;
    }

    error = undefined;
    sent = 'earlier';
    step = 'code';
  };

  const backToEmail = (): void => {
    step = 'email';
    otp = '';
    error = undefined;
  };
</script>

{#snippet errorLine()}
  {#if error}
    <p role="alert" class="text-destructive text-sm">{error}</p>
  {/if}
{/snippet}

{#if step === 'code'}
  <form onsubmit={handleVerify} class="flex flex-col gap-4">
    <p class="text-muted-foreground text-sm">
      {#if sent === 'now'}
        We sent a code to {email}.
      {:else if sent === 'again'}
        We sent a new code to {email}. Codes from earlier emails no longer
        work.
      {:else}
        Enter the code from the most recent email we sent to {email}.
      {/if}
    </p>

    <div class="flex flex-col gap-2">
      <Label for={codeId}>Code</Label>
      <!-- Spaces from a pasted code would fail the pattern before the form
           ever submits. The binding writes the code back without them. -->
      <Input
        bind:ref={codeInput}
        id={codeId}
        name="otp"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        pattern="[0-9]*"
        bind:value={() => otp, (value) => (otp = value.replace(/\s/g, ''))}
        disabled={isPending}
        required
      />
    </div>

    {@render errorLine()}

    <Button type="submit" disabled={isPending || !otp}>
      {isPending ? 'Signing in…' : 'Sign in'}
    </Button>

    <div class="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending}
        onclick={() => void send()}
      >
        Send a new code
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending}
        onclick={backToEmail}
      >
        Use a different address
      </Button>
    </div>
  </form>
{:else}
  <form onsubmit={handleSend} class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <Label for={emailId}>Email</Label>
      <Input
        id={emailId}
        name="email"
        type="email"
        autocomplete="email"
        placeholder="you@example.com"
        bind:value={email}
        disabled={isPending}
        required
      />
    </div>

    {@render errorLine()}

    <Button type="submit" disabled={isPending || !email}>
      {isPending ? 'Sending…' : 'Send me a code'}
    </Button>

    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending || !email}
      onclick={haveCode}
    >
      I already have a code
    </Button>
  </form>
{/if}
