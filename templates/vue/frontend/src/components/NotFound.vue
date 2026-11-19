<script setup lang="ts">
import CenteredLayout from '@/components/CenteredLayout.vue';
</script>

<!-- What any path without a page shows, as Next's default not-found page. -->
<template>
  <CenteredLayout>
    <div class="flex items-center justify-center gap-4">
      <h1 class="border-r pr-4 font-medium text-2xl">404</h1>
      <p class="text-sm">This page could not be found.</p>
    </div>
  </CenteredLayout>
</template>
