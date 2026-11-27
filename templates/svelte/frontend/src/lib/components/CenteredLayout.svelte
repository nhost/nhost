<!--
  @component
  Centres a page's single card in the space under the nav, for the sign-in
  list, every method's page and the home page.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<div class="flex min-h-[calc(100svh-11.875rem)] flex-col justify-center">
  <div>{@render children()}</div>
</div>
