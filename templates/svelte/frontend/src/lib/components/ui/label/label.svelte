<script lang="ts">
  import type { HTMLLabelAttributes } from 'svelte/elements';
  import { cn } from '#lib/utils.ts';

  let {
    class: className,
    children,
    ...props
  }: HTMLLabelAttributes = $props();
</script>

<!-- biome-ignore lint/a11y/noLabelWithoutControl: every use passes for -->
<label
  data-slot="label"
  class={cn(
    'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
    className,
  )}
  {...props}
>
  {@render children?.()}
</label>
