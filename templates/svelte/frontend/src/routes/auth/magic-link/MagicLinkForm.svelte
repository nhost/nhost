<script lang="ts">
import CheckYourInbox from '$lib/components/CheckYourInbox.svelte';
import { Button } from '$lib/components/ui/button';
import { Input } from '$lib/components/ui/input';
import { Label } from '$lib/components/ui/label';
import { useAuth } from '$lib/nhost/auth.svelte';
import { sendMagicLink } from './actions';

let { next, mailboxUrl }: { next: string; mailboxUrl: string | null } =
  $props();

const auth = useAuth();
const uid = $props.id();
const emailId = `${uid}-email`;

let email = $state('');
let sent = $state(false);
let error = $state<string | undefined>();
let isSending = $state(false);

async function handleSubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  error = undefined;
  isSending = true;
  try {
    const result = await sendMagicLink(auth.nhost, email, next);
    if (result?.error) {
      error = result.error;
      return;
    }

    sent = true;
  } catch (err) {
    console.error('Error sending the magic link:', err);
    error = 'The request did not reach the server. Try again.';
  } finally {
    isSending = false;
  }
}

function useDifferentAddress(): void {
  sent = false;
  email = '';
  error = undefined;
}
</script>

{#if sent}
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <CheckYourInbox url={mailboxUrl} />
      <p class="text-muted-foreground text-sm">
        A sign-in link is on its way to {email}. Opening it signs you in on this
        device.
      </p>
    </div>
    <Button
      type="button"
      variant="ghost"
      size="sm"
      class="self-start"
      onclick={useDifferentAddress}
    >
      Use a different address
    </Button>
  </div>
{:else}
  <form class="flex flex-col gap-4" onsubmit={handleSubmit}>
    <div class="flex flex-col gap-2">
      <Label for={emailId}>Email</Label>
      <Input
        id={emailId}
        type="email"
        autocomplete="email"
        placeholder="you@example.com"
        required
        bind:value={email}
        disabled={isSending}
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
