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
          <RouterLink to="/profile" class="nav-link">
            Profile
          </RouterLink>
        </template>
        <template v-else>
          Placeholder for signin/signup links
        </template>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";
import { useAuth } from "../lib/nhost/auth";

const { isAuthenticated } = useAuth();
</script>
