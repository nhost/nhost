<!--
  @component
  Sends the visitor back to the list of sign-in methods, when there is a list
  worth going back to.
-->
<script lang="ts">
  import { buttons, methods } from './methods.ts';

  let { query }: { query: string } = $props();
</script>

<!-- self-center, since every page that uses this stacks its card content in a
     column: a flex item stretches by default, which left the link against the
     edge of a card whose heading is centred. -->
{#if methods.length + buttons.length >= 2}
  <a
    href={`/signin${query}`}
    class="self-center text-muted-foreground text-sm underline-offset-4 hover:underline"
  >
    Other ways to sign in
  </a>
{/if}
