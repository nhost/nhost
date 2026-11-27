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
  data-slot="card-header"
  class={cn(
    '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
    className,
  )}
  {...props}
>
  {@render children?.()}
</div>
