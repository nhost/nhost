<script setup lang="ts">
defineProps<{ label: string; value?: string }>();
</script>

<template>
  <li class="flex min-h-14 items-center gap-3 px-5 py-2 text-sm">
    <span class="w-24 shrink-0 font-medium sm:w-30">{{ label }}</span>
    <!-- min-w-0 so a long address truncates rather than pushing the button
         off the row. -->
    <span class="min-w-0 flex-1 truncate text-muted-foreground">
      <slot name="value">{{ value }}</slot>
    </span>
    <slot />
  </li>
</template>
