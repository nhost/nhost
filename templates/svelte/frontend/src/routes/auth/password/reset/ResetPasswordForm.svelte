<script lang="ts">
import { Button } from '$lib/components/ui/button';
import { Input } from '$lib/components/ui/input';
import { Label } from '$lib/components/ui/label';
import { useAuth } from '$lib/nhost/auth.svelte';
import { setNewPassword } from '../actions';

let {
  pending = $bindable(false),
  onchanged,
}: { pending?: boolean; onchanged: VoidFunction } = $props();

const auth = useAuth();

// `$props.id()` has to be a plain declaration initializer, so the suffix is
// added on the next line.
const uid = $props.id();
const passwordId = `${uid}-password`;

let password = $state('');
let error = $state<string | undefined>();

async function handleSubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  error = undefined;
  pending = true;
  try {
    const result = await setNewPassword(auth.nhost, password);
    if (result.error) {
      error = result.error;
      return;
    }

    onchanged();
  } catch (err) {
    console.error('Error changing the password:', err);
    error = 'The request did not reach the server. Try again.';
  } finally {
    pending = false;
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
      disabled={pending}
    />
  </div>

  {#if error}
    <p role="alert" class="text-destructive text-sm">{error}</p>
  {/if}

  <Button type="submit" disabled={pending || !password}>
    {pending ? 'Saving…' : 'Save the new password'}
  </Button>
</form>
