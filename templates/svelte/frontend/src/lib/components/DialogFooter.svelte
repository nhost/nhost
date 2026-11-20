<!-- @component The buttons at the foot of a dialog, with the one that acts last. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<div class="flex justify-end gap-2">{@render children()}</div>
