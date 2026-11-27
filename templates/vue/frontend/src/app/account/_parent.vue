<script setup lang="ts">
import ReplacePageLayout from '@/components/ReplacePageLayout.vue';
import ToastProvider from '@/components/ToastProvider.vue';
</script>

<!-- The toasts sit outside the replaced page, so the one a form shows as it
     finishes is still there after the page under it renders again. -->
<template>
  <ToastProvider>
    <ReplacePageLayout><RouterView /></ReplacePageLayout>
  </ToastProvider>
</template>
