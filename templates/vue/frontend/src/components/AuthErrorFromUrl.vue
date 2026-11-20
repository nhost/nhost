<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AuthErrorNotice from '@/components/AuthErrorNotice.vue';
import { firstQueryValue } from '@/lib/routeQuery';

/** Shows `AuthErrorNotice` for the current URL, on any page. */
const route = useRoute();
const error = computed(() => firstQueryValue(route.query.error));
</script>

<template>
  <div v-if="error" class="mx-auto mb-4 max-w-sm">
    <AuthErrorNotice :error="error" />
  </div>
</template>
