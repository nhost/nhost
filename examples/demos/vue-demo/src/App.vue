<template>
  <div class="flex-col min-h-screen">
    <Navigation />
    <main class="max-w-2xl mx-auto p-6 w-full">
      <router-view />
    </main>
    <footer>
      <p class="text-sm text-center" style="color: var(--text-muted)">
        © {{ new Date().getFullYear() }} Nhost Demo
      </p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import Navigation from "./components/Navigation.vue";
</script>

<style>
@import "./assets/main.css";

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
