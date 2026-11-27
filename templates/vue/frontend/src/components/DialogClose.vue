<script setup lang="ts">
import { useCloseDialog } from '@/components/dialog';
import { Button } from '@/components/ui/button';

/** Closes the dialog without doing anything else. */
defineProps<{ disabled?: boolean }>();

const close = useCloseDialog();
</script>

<template>
  <Button
    type="button"
    variant="outline"
    size="sm"
    :disabled="disabled"
    @click="close"
  >
    <slot>Cancel</slot>
  </Button>
</template>
