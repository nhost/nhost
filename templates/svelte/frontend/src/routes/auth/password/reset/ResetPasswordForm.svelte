<script lang="ts">
import { goto } from '$app/navigation';
import { Button } from '$lib/components/ui/button';
import { Input } from '$lib/components/ui/input';
import { Label } from '$lib/components/ui/label';
import { useAuth } from '$lib/nhost/auth.svelte';
import { setNewPassword } from '../actions';

const auth = useAuth();

// `$props.id()` has to be a plain declaration initializer, so the suffix is
// added on the next line.
const uid = $props.id();
const passwordId = `${uid}-password`;

let password = $state('');
let error = $state<string | undefined>();
let isPending = $state(false);

async function handleSubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  error = undefined;
  isPending = true;
  try {
    const result = await setNewPassword(auth.nhost, password);
    if (result.error) {
      error = result.error;
      return;
    }

    // The link already signed them in, so there is nowhere to send them but
    // on into the app.
    await goto('/protected');
  } catch (err) {
    console.error('Error changing the password:', err);
    error = 'The request did not reach the server. Try again.';
  } finally {
    isPending = false;
  }
}
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
      disabled={isPending}
    />
  </div>

  {#if error}
    <p role="alert" class="text-destructive text-sm">{error}</p>
  {/if}

  <Button type="submit" disabled={isPending || !password}>
    {isPending ? 'Saving…' : 'Save the new password'}
  </Button>
</form>
