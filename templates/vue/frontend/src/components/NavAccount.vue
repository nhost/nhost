<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

/**
 * The right of the nav: the account when there is a session, the ways in when
 * there is not.
 */
const props = defineProps<{ signedIn: boolean; signedOutPaths: string[] }>();

const route = useRoute();
const looksSignedOut = computed(() =>
  props.signedOutPaths.some(
    (path) => route.path === path || route.path.startsWith(`${path}/`),
  ),
);
</script>

<template>
  <slot v-if="signedIn && !looksSignedOut" name="signed-in" />
  <slot v-else name="signed-out" />
</template>
