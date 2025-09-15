<template>
  <nav class="navbar">
    <div class="navbar-container">
      <router-link to="/" class="navbar-brand"> Nhost Vue Demo </router-link>

      <div class="navbar-links">
        <template v-if="isAuthenticated">
          <router-link
            to="/todos"
            class="nav-link"
            :class="{ active: $route.path === '/todos' }"
          >
            Todos
          </router-link>
          <router-link
            to="/profile"
            class="nav-link"
            :class="{ active: $route.path === '/profile' }"
          >
            Profile
          </router-link>
          <router-link
            to="/upload"
            class="nav-link"
            :class="{ active: $route.path === '/upload' }"
          >
            Upload
          </router-link>
          <button @click="handleSignOut" class="nav-link" :disabled="isLoading">
            {{ isLoading ? "Signing Out..." : "Sign Out" }}
          </button>
        </template>

        <template v-else>
          <router-link
            to="/signin"
            class="nav-link"
            :class="{ active: $route.path === '/signin' }"
          >
            Sign In
          </router-link>
          <router-link
            to="/signup"
            class="nav-link"
            :class="{ active: $route.path === '/signup' }"
          >
            Sign Up
          </router-link>
        </template>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../lib/nhost/auth";

const { nhost, isAuthenticated, session } = useAuth();
const router = useRouter();
const isLoading = ref(false);

const handleSignOut = async () => {
  isLoading.value = true;

  try {
    if (session.value) {
      await nhost.auth.signOut({
        refreshToken: session.value.refreshToken,
      });
    }
    router.push("/");
  } catch (error) {
    console.error("Error signing out:", error);
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
button.nav-link {
  background: none;
  border: none;
  cursor: pointer;
}

button.nav-link:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
