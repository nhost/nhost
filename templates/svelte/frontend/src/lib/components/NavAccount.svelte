<!--
  @component
  The right of the nav: the account when there is a session, the ways in when
  there is not, or when the page says this browser has been signed out.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import { signedOutHere } from './signedOutHere.svelte.ts';

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
    signedOutHere.current ||
      signedOutPaths.some(
        (path) =>
          page.url.pathname === path ||
          page.url.pathname.startsWith(`${path}/`),
      ),
  );
</script>

{#if signedIn && !looksSignedOut}
  {@render signedIn()}
{:else}
  {@render signedOut()}
{/if}
