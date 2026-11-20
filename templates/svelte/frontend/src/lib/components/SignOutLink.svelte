<!-- @component Sign out as a link in running text. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useSignOut } from '#lib/components/useSignOut.svelte.ts';

  let { children }: { children: Snippet } = $props();

  const signOut = useSignOut();
</script>

<button
  type="button"
  disabled={signOut.isSigningOut}
  onclick={() => void signOut.handleSignOut()}
  class="cursor-pointer text-foreground underline underline-offset-4 disabled:cursor-default disabled:opacity-50"
>
  {@render children()}
</button>
{#if signOut.error}
  <span role="alert" class="text-destructive">({signOut.error})</span>
{/if}
