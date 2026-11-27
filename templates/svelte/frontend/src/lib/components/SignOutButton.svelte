<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import { useSignOut } from '#lib/components/useSignOut.svelte.ts';

  const signOut = useSignOut();
</script>

<div class="flex flex-col items-end gap-1">
  <Button
    type="button"
    variant="outline"
    size="sm"
    disabled={signOut.isSigningOut}
    onclick={() => void signOut.handleSignOut()}
  >
    {signOut.isSigningOut ? 'Signing out…' : 'Sign out'}
  </Button>
  {#if signOut.error}
    <p role="alert" class="text-destructive text-sm">{signOut.error}</p>
  {/if}
</div>
