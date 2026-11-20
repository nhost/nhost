<script setup lang="ts">
import { type Component, provide, shallowRef } from 'vue';
import { REPLACE_PAGE } from '@/components/replacePage';

/** Renders its default slot until a form under it swaps in a replacement page. */
const replaced = shallowRef<{
  page: Component;
  props?: Record<string, unknown>;
}>();

provide(REPLACE_PAGE, (page, props) => {
  replaced.value = { page, props };
});
</script>

<template>
  <component :is="replaced.page" v-if="replaced" v-bind="replaced.props" />
  <slot v-else />
</template>
