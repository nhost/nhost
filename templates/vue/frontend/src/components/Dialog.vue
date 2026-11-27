<script setup lang="ts">
import { provide, useId, useSlots, useTemplateRef, watchEffect } from 'vue';
import { CLOSE_DIALOG } from '@/components/dialog';
import ToastStatus from '@/components/ToastStatus.vue';

/** A modal on the browser's own `<dialog>`. */
const props = defineProps<{ title: string; description?: string }>();
const open = defineModel<boolean>('open', { required: true });
const slots = useSlots();

const dialog = useTemplateRef<HTMLDialogElement>('dialog');
let pressedBackdrop = false;
const titleId = useId();
const descriptionId = useId();
const hasDescription = (): boolean =>
  Boolean(props.description || slots.description);

watchEffect(
  () => {
    const el = dialog.value;
    if (open.value && !el?.open) {
      el?.showModal();
    } else if (!open.value && el?.open) {
      el.close();
    }
  },
  { flush: 'post' },
);

// Escape closes the element by itself; `@close` keeps the model in step.
const close = (): void => {
  open.value = false;
};
provide(CLOSE_DIALOG, close);

// The contents fill the dialog, so a press that lands on the element itself
// is on the backdrop.
function onPointerDown(event: PointerEvent): void {
  pressedBackdrop = event.target === event.currentTarget;
}

function onClick(event: MouseEvent): void {
  if (pressedBackdrop && event.target === event.currentTarget) {
    close();
  }
}
</script>

<template>
  <!-- biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard's way out is Escape, which the element handles itself -->
  <dialog
    ref="dialog"
    :aria-labelledby="titleId"
    :aria-describedby="hasDescription() ? descriptionId : undefined"
    class="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/60"
    @close="close"
    @pointerdown="onPointerDown"
    @click="onClick"
  >
    <div v-if="open" class="flex flex-col gap-5 p-6">
      <div class="flex flex-col gap-1.5">
        <h2 :id="titleId" class="font-semibold text-lg leading-tight">
          {{ title }}
        </h2>
        <p
          v-if="hasDescription()"
          :id="descriptionId"
          class="text-muted-foreground text-sm"
        >
          <slot name="description">{{ description }}</slot>
        </p>
      </div>
      <slot />
      <ToastStatus />
    </div>
  </dialog>
</template>
