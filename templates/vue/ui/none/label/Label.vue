<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';

/**
 * A plain `<label>`. Clicking it focuses the control it names, which the
 * browser does for any label carrying `for`, so the reka-ui primitive the
 * shadcn-vue version wraps is not needed to get that behaviour.
 */
const props = defineProps<{
  for?: string;
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <label
    data-slot="label"
    :for="props.for"
    :class="
      cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        props.class,
      )
    "
  >
    <slot />
  </label>
</template>
