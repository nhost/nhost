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
  data-slot="card"
  class={cn(
    'bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm',
    className,
  )}
  {...props}
>
  {@render children?.()}
</div>
