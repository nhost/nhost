<template>
  <div id="app">
    <Navigation />
    <div class="app-content">
      <RouterView />
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router';
import Navigation from './components/Navigation.vue';
</script>
