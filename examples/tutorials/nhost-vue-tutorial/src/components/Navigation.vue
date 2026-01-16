<template>
  <nav class="navigation">
    <div class="nav-container">
      <RouterLink to="/" class="nav-logo">
        Nhost Vue Demo
      </RouterLink>

      <div class="nav-links">
        <RouterLink to="/" class="nav-link">
          Home
        </RouterLink>

        <template v-if="isAuthenticated">
          <RouterLink to="/todos" class="nav-link">
            Todos
          </RouterLink>
          <RouterLink to="/files" class="nav-link">
            Files
          </RouterLink>
          <RouterLink to="/profile" class="nav-link">
            Profile
          </RouterLink>
          <button
            @click="handleSignOut"
            class="nav-link nav-button"
          >
            Sign Out
          </button>
        </template>
        <template v-else>
          <RouterLink to="/signin" class="nav-link">
            Sign In
          </RouterLink>
          <RouterLink to="/signup" class="nav-link">
            Sign Up
          </RouterLink>
        </template>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router';
import { useAuth } from '../lib/nhost/auth';

const { isAuthenticated, session, nhost } = useAuth();
const router = useRouter();

const handleSignOut = async () => {
  try {
    if (session.value) {
      await nhost.auth.signOut({
        refreshToken: session.value.refreshToken,
      });
    }
    router.push('/');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error signing out:', message);
  }
};
</script>
