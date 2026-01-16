<template>
  <div class="container">
    <header class="page-header">
      <h1 class="page-title">Welcome to Nhost Vue Demo</h1>
    </header>

    <div v-if="isAuthenticated">
      <p>Hello, {{ user?.displayName || user?.email }}!</p>
    </div>
    <div v-else>
      <p>You are not signed in.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '../lib/nhost/auth';

const { isAuthenticated, user } = useAuth();
</script>
