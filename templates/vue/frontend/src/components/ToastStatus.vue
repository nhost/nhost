<script setup lang="ts">
import { useCurrentToast } from '@/components/toast';

/**
 * Repeats the toast for screen readers from inside an open modal dialog,
 * which makes the toast itself inert.
 */
const toast = useCurrentToast();
</script>

<template>
  <div role="status" aria-live="polite" class="sr-only">
    <span v-if="toast" :key="toast.id">{{ toast.message }}</span>
  </div>
</template>
