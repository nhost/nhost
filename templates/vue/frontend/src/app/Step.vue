<!-- One numbered step on the home page. -->
<script setup lang="ts">
defineProps<{ n: number; title: string }>();
</script>

<template>
  <li class="flex gap-4">
    <span
      class="flex size-7 shrink-0 items-center justify-center rounded-full border font-medium text-sm"
    >
      {{ n }}
    </span>
    <div class="flex flex-col gap-2 pt-0.5">
      <h2 class="font-medium">{{ title }}</h2>
      <div class="flex flex-col gap-3 text-muted-foreground text-sm">
        <slot />
      </div>
    </div>
  </li>
</template>
