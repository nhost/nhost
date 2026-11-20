<!--
  @component
  A short line confirming that something worked, for the changes whose result
  is not otherwise in view: a copied id, or a setting changed in a dialog that
  has closed.
-->
<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { provideToasts } from './toast.svelte.ts';

  let { children }: { children: Snippet } = $props();

  const toasts = provideToasts();
  let region: HTMLDivElement;

  onMount(() => {
    region.showPopover?.();
  });

  $effect(() => {
    const toast = toasts.current;
    if (!toast) {
      return;
    }

    if (region.showPopover) {
      region.hidePopover();
      region.showPopover();
    }

    const timer = setTimeout(() => {
      if (toasts.current?.id === toast.id) {
        toasts.current = undefined;
      }
    }, 2400);
    return () => clearTimeout(timer);
  });
</script>

{@render children()}
<div
  bind:this={region}
  popover="manual"
  role="status"
  aria-live="polite"
  class="pointer-events-none fixed inset-x-0 top-auto bottom-6 m-0 flex h-auto w-auto max-w-none justify-center overflow-visible border-0 bg-transparent px-4 py-0"
>
  {#if toasts.current}
    {#key toasts.current.id}
      <p class="rounded-lg border bg-secondary px-4 py-2.5 text-sm shadow-lg">
        {toasts.current.message}
      </p>
    {/key}
  {/if}
</div>
