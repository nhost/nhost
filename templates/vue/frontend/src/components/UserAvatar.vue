<script setup lang="ts">
import { computed } from 'vue';
import type { AvatarWidth } from '@/app/account/avatar';
import { useAvatarSrc } from '@/app/account/useAvatarSrc';

/**
 * The account's picture over its initial, so the initial shows wherever the
 * picture does not paint.
 */
const props = defineProps<{
  avatarUrl: string | undefined;
  displayName: string;
  width: AvatarWidth;
}>();

const src = useAvatarSrc(
  () => props.avatarUrl,
  () => props.width,
);

// Falls back to a dot rather than an empty disc: a display name can be an
// empty string, and an account made by magic link often starts that way.
const initial = computed(
  () => props.displayName.trim().slice(0, 1).toUpperCase() || '·',
);
</script>

<template>
  <div
    aria-hidden="true"
    class="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground"
  >
    {{ initial }}
    <img
      v-if="src"
      :src="src"
      alt=""
      class="absolute inset-0 size-full object-cover"
    >
  </div>
</template>
