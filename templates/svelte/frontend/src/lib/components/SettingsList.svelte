<!-- @component The rows of the account page's settings. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<ul class="divide-y">{@render children()}</ul>
