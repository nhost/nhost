<script setup lang="ts">
import AuthErrorFromUrl from '@/components/AuthErrorFromUrl.vue';
import Footer from '@/components/Footer.vue';
import Nav from '@/components/Nav.vue';
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <Nav />
    <main class="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <AuthErrorFromUrl />
      <RouterView />
    </main>
    <Footer />
  </div>
</template>
