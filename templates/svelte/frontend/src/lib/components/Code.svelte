<!-- @component A file path or command inside running text. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]"
  >{@render children()}</code
>
