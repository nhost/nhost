<script lang="ts">
import { goto } from '$app/navigation';
import CheckYourInbox from '$lib/components/CheckYourInbox.svelte';
import { Button } from '$lib/components/ui/button';
import { Input } from '$lib/components/ui/input';
import { Label } from '$lib/components/ui/label';
import { useAuth } from '$lib/nhost/auth.svelte';
import { sendCode, verifyCode } from './actions';

let { next, mailboxUrl }: { next: string; mailboxUrl: string | null } =
  $props();

type Step = 'email' | 'code';

const auth = useAuth();
const uid = $props.id();
const emailId = `${uid}-email`;
const codeId = `${uid}-code`;
const sentId = `${uid}-sent`;

let step = $state<Step>('email');
let email = $state('');
let otp = $state('');
let error = $state<string | undefined>();
let isPending = $state(false);

async function send(): Promise<void> {
  error = undefined;
  isPending = true;
  try {
    const result = await sendCode(auth.nhost, email);
    if (result?.error) {
      error = result.error;
      return;
    }

    otp = '';
    step = 'code';
  } catch (err) {
    console.error('Error sending the code:', err);
    error = 'The request did not reach the server. Try again.';
  } finally {
    isPending = false;
  }
}

async function handleSend(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  await send();
}

async function handleVerify(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  error = undefined;
  isPending = true;
  try {
    const result = await verifyCode(auth.nhost, email, otp);
    if (result?.error) {
      error = result.error;
      return;
    }

    await goto(next);
  } catch (err) {
    console.error('Error verifying the code:', err);
    error = 'The request did not reach the server. Try again.';
  } finally {
    isPending = false;
  }
}

// The code step mounts only once a code is sent, and by then the email form
// and the button that had focus are gone. Focusing the code field, which is
// described by the "we sent a code" text, is what announces the new step.
function focusOnMount(node: HTMLElement): void {
  node.focus();
}

function backToEmail(): void {
  step = 'email';
  otp = '';
  error = undefined;
}
</script>

{#if step === 'code'}
  <form class="flex flex-col gap-4" onsubmit={handleVerify}>
    <div id={sentId} class="flex flex-col gap-2">
      <CheckYourInbox url={mailboxUrl} />
      <p class="text-muted-foreground text-sm">
        We sent a code to {email}.
      </p>
    </div>

    <div class="flex flex-col gap-2">
      <Label for={codeId}>Code</Label>
      <Input
        id={codeId}
        aria-describedby={sentId}
        {@attach focusOnMount}
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        pattern="[0-9]*"
        required
        bind:value={otp}
        disabled={isPending}
      />
    </div>

    {#if error}
      <p role="alert" class="text-destructive text-sm">{error}</p>
    {/if}

    <Button type="submit" disabled={isPending || !otp}>
      {isPending ? 'Signing in…' : 'Sign in'}
    </Button>

    <div class="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending}
        onclick={send}
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
  <form class="flex flex-col gap-4" onsubmit={handleSend}>
    <div class="flex flex-col gap-2">
      <Label for={emailId}>Email</Label>
      <Input
        id={emailId}
        type="email"
        autocomplete="email"
        placeholder="you@example.com"
        required
        bind:value={email}
        disabled={isPending}
      />
    </div>

    {#if error}
      <p role="alert" class="text-destructive text-sm">{error}</p>
    {/if}

    <Button type="submit" disabled={isPending || !email}>
      {isPending ? 'Sending…' : 'Send me a code'}
    </Button>
  </form>
{/if}
