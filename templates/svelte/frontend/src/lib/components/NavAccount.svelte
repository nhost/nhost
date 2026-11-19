<!--
  @component
  The right of the nav: the account when there is a session, the ways in when
  there is not.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';

  let {
    signedIn,
    signedOut,
    signedOutPaths,
  }: {
    signedIn: Snippet | null;
    signedOut: Snippet;
    signedOutPaths: string[];
  } = $props();

  const looksSignedOut = $derived(
    signedOutPaths.some(
      (path) =>
        page.url.pathname === path || page.url.pathname.startsWith(`${path}/`),
    ),
  );
</script>

{#if signedIn && !looksSignedOut}
  {@render signedIn()}
{:else}
  {@render signedOut()}
{/if}
