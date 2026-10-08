<script setup lang="ts">
import LinkErrorNotice from '@/components/LinkErrorNotice.vue';
import Nav from '@/components/Nav.vue';
</script>

<template>
  <Nav />
  <main class="mx-auto max-w-4xl px-6 py-10">
    <LinkErrorNotice />
    <RouterView />
  </main>
</template>
