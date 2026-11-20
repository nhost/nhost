<!-- @component Closes the dialog without doing anything else. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Button } from '#lib/components/ui/button/index.ts';
  import { useCloseDialog } from './dialog.ts';

  let {
    disabled,
    children,
  }: { disabled?: boolean; children?: Snippet | string } = $props();

  const close = useCloseDialog();
</script>

<Button type="button" variant="outline" size="sm" {disabled} onclick={close}>
  {#if typeof children === 'function'}
    {@render children()}
  {:else}
    {children ?? 'Cancel'}
  {/if}
</Button>
