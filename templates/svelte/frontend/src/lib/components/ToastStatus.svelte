<!--
  @component
  Repeats the toast for screen readers from inside an open modal dialog, which
  makes the toast itself inert.
-->
<script lang="ts">
  import { useCurrentToast } from './toast.svelte.ts';

  const toast = useCurrentToast();
</script>

<div role="status" aria-live="polite" class="sr-only">
  {#if toast.current}
    {#key toast.current.id}<span>{toast.current.message}</span>{/key}
  {/if}
</div>
