<script lang="ts">
import type { HTMLLabelAttributes } from 'svelte/elements';
import { cn, type WithElementRef } from '$lib/utils.js';

/**
 * A plain `<label>`. Clicking it focuses the control it names, which the
 * browser does for any label carrying `for`, so the bits-ui primitive the
 * shadcn-svelte version wraps is not needed to get that behaviour.
 */
let {
  ref = $bindable(null),
  class: className,
  children,
  ...restProps
}: WithElementRef<HTMLLabelAttributes, HTMLLabelElement> = $props();
</script>

<label
  bind:this={ref}
  data-slot="label"
  class={cn(
    'gap-2 text-sm leading-none font-medium group-data-[disabled=true]:opacity-50 peer-disabled:opacity-50 flex items-center select-none group-data-[disabled=true]:pointer-events-none peer-disabled:cursor-not-allowed',
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</label>
