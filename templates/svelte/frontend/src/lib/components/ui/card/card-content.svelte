<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '#lib/utils.ts';

  let {
    class: className,
    children,
    ...props
  }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div
  data-slot="card-content"
  class={cn(
    'px-6',
    className,
  )}
  {...props}
>
  {@render children?.()}
</div>
