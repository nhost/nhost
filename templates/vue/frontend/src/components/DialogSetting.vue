<script setup lang="ts">
import Dialog from '@/components/Dialog.vue';
import SettingRow from '@/components/SettingRow.vue';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** A row whose button opens a dialog with the default slot in it. */
withDefaults(
  defineProps<{
    label: string;
    value?: string;
    action: string;
    title: string;
    description?: string;
    destructive?: boolean;
  }>(),
  { destructive: false },
);
const open = defineModel<boolean>('open', { default: false });
// As the row's button opens the dialog.
const emit = defineEmits<{ opening: [] }>();

function openDialog(): void {
  emit('opening');
  open.value = true;
}
</script>

<template>
  <SettingRow :label="label" :value="value">
    <template v-if="$slots.value" #value><slot name="value" /></template>
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-haspopup="dialog"
      :class="
        cn('shrink-0', destructive && 'text-destructive hover:text-destructive')
      "
      @click="openDialog"
    >
      {{ action }}
    </Button>
    <Dialog v-model:open="open" :title="title" :description="description">
      <template v-if="$slots.description" #description>
        <slot name="description" />
      </template>
      <slot />
    </Dialog>
  </SettingRow>
</template>
