<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
import { useAuth } from '@/lib/nhost/auth';

const { isAuthenticated } = useAuth();
</script>

<template>
  <nav class="nav">
    <RouterLink to="/">Nhost + Vue</RouterLink>
    <div class="row">
      <RouterLink to="/signin">Sign in</RouterLink>
      <RouterLink to="/protected">
        {{ isAuthenticated ? 'Your todos' : 'Protected' }}
      </RouterLink>
    </div>
  </nav>
  <main class="container">
    <RouterView />
  </main>
</template>
