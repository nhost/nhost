<script setup lang="ts">
import {
  onMounted,
  provide,
  readonly,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue';
import {
  CURRENT_TOAST,
  SHOW_TOAST,
  type ShowToast,
  type Toast,
} from '@/components/toast';

/**
 * A short line confirming that something worked, for the changes whose result
 * is not otherwise in view: a copied id, or a setting changed in a dialog that
 * has closed.
 */
const region = useTemplateRef<HTMLDivElement>('region');
const toast = shallowRef<Toast>();
let count = 0;

onMounted(() => {
  region.value?.showPopover?.();
});

watch(
  toast,
  (current, _before, onCleanup) => {
    if (!current) {
      return;
    }

    const el = region.value;
    if (el?.showPopover) {
      el.hidePopover();
      el.showPopover();
    }

    const timer = setTimeout(() => {
      toast.value = undefined;
    }, 2400);
    onCleanup(() => clearTimeout(timer));
  },
  { flush: 'post' },
);

const show: ShowToast = (message) => {
  count += 1;
  const id = count;
  toast.value = { id, message };

  return () => {
    if (toast.value?.id === id) {
      toast.value = undefined;
    }
  };
};

provide(SHOW_TOAST, show);
provide(CURRENT_TOAST, readonly(toast));
</script>

<template>
  <slot />
  <div
    ref="region"
    popover="manual"
    role="status"
    aria-live="polite"
    class="pointer-events-none fixed inset-x-0 top-auto bottom-6 m-0 flex h-auto w-auto max-w-none justify-center overflow-visible border-0 bg-transparent px-4 py-0"
  >
    <p
      v-if="toast"
      :key="toast.id"
      class="rounded-lg border bg-secondary px-4 py-2.5 text-sm shadow-lg"
    >
      {{ toast.message }}
    </p>
  </div>
</template>
