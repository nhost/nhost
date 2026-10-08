<script lang="ts">
import { goto } from '$app/navigation';
import { Button } from '$lib/components/ui/button';
import { useAuth } from '$lib/nhost/auth.svelte';

const auth = useAuth();

let error = $state<string | undefined>();
let isSigningOut = $state(false);

async function handleSignOut(): Promise<void> {
  error = undefined;
  isSigningOut = true;
  try {
    // Clears the stored session, which the session watch in
    // `lib/nhost/watchSession.ts` hears in this tab and every other one, so
    // they all drop to signed out without this having to tell them.
    await auth.nhost.auth.signOut({
      refreshToken: auth.nhost.getUserSession()?.refreshToken ?? '',
    });

    await goto('/');
  } catch (err) {
    console.error('Error signing out:', err);
    error = 'The request did not reach the server. Try again.';
  } finally {
    isSigningOut = false;
  }
}
</script>

<div class="flex flex-col items-end gap-1">
  <Button
    type="button"
    variant="outline"
    size="sm"
    disabled={isSigningOut}
    onclick={handleSignOut}
  >
    {isSigningOut ? 'Signing out…' : 'Sign out'}
  </Button>
  {#if error}
    <p role="alert" class="text-destructive text-sm">{error}</p>
  {/if}
</div>
