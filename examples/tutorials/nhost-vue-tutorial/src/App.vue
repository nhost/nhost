<template>
  <div id="app">
    <AppNavigation />
    <div class="app-content">
      <RouterView />
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router';
import AppNavigation from './components/AppNavigation.vue';
</script>
